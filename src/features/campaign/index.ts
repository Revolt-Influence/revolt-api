import { DocumentType, mongoose } from '@typegoose/typegoose'
import { emailService } from '../../utils/emails'
import { CustomError, errorNames } from '../../utils/errors'
import { Brand, BrandModel } from '../brand/model'
import { CollabModel } from '../collab/model'
import { Creator, CreatorModel } from '../creator/model'
import { UserModel } from '../user/model'
import {
  Campaign,
  CampaignModel,
  CampaignProduct,
  TargetAudience,
  defaultCampaignProduct,
} from './model'
import { CampaignBriefInput, PaginatedCampaignResponse, CreateCampaignInput } from './resolver'

const CAMPAIGNS_PER_PAGE = 1000 // TODO: real pagination for campaigns
const CREATORS_CAMPAIGNS_PER_PAGE = 11 // leave 1 card for ambassador program

async function createCampaign(
  owner: mongoose.Types.ObjectId,
  campaignData: CreateCampaignInput
): Promise<DocumentType<Campaign>> {
  // Prepare brand to associate with campaign
  const brandDraft: Partial<Brand> = {
    name: campaignData.brandName,
    logo: '',
    website: '',
    users: [owner],
  }
  const brand = new BrandModel(brandDraft)
  await brand.save()
  // Prepare campaign
  const campaign = new CampaignModel({
    owner,
    product: {
      ...defaultCampaignProduct,
      name: campaignData.productName,
      website: campaignData.website,
    },
    brand: brand._id,
  } as Partial<Campaign>)
  // Save campaign to database
  await campaign.save()
  // Notify an admin that a campaign was created
  sendNewCampaignEmail(campaign)
  // Return campaign from find so we get the object with the Mongoose defaults
  const fullCampaign = await CampaignModel.findById(campaign._id)
  return fullCampaign
}

async function getCampaignById(
  campaignId: mongoose.Types.ObjectId
): Promise<DocumentType<Campaign>> {
  // Find the right campaign
  const campaign = await CampaignModel.findById(campaignId).populate('brand')
  // Check if exists
  if (campaign == null) {
    throw new CustomError(404, errorNames.campaignNotFound)
  }
  return campaign
}

async function getCampaignsFromQuery(query: any, page: number): Promise<PaginatedCampaignResponse> {
  const campaignsPromise = CampaignModel.find(query)
    .sort({ createdAt: -1 }) // recent to old
    .skip((page - 1) * CAMPAIGNS_PER_PAGE)
    .limit(CAMPAIGNS_PER_PAGE)
    .exec()
  const totalCountPromise = CampaignModel.find(query)
    .countDocuments()
    .exec()
  const [campaigns, totalCount] = await Promise.all([campaignsPromise, totalCountPromise])
  const totalPages = Math.ceil(totalCount / CAMPAIGNS_PER_PAGE)
  return { items: campaigns, totalPages, currentPage: page }
}

async function getUserCampaigns(
  userId: mongoose.Types.ObjectId,
  page: number = 1
): Promise<PaginatedCampaignResponse> {
  const query = { owner: userId }
  return getCampaignsFromQuery(query, page)
}

async function getAdminCampaigns(userId: mongoose.Types.ObjectId, page: number = 1) {
  const query = {}
  return getCampaignsFromQuery(query, page)
}

async function sendNewCampaignEmail(campaign: DocumentType<Campaign>): Promise<void> {
  const owner = await UserModel.findById(campaign.owner).populate('ambassador')
  const brand = await BrandModel.findById(campaign.brand)
  const ambassador = owner && (owner.ambassador as Creator)
  await emailService.send({
    template: 'newCampaign',
    locals: {
      campaignName: campaign.product.name,
      dashboardLink: `${process.env.APP_URL}/brand/campaigns/${campaign._id}/dashboard?tab=brief`,
      brandName: brand.name,
      brandEmail: owner.email,
      ambassador: ambassador && ambassador.email,
    },
    message: {
      from: 'Revolt Gaming <campaigns@revoltgaming.co>',
      to: process.env.CAMPAIGN_MANAGER_EMAIL,
    },
  })
}

async function toggleArchiveCampaign(
  campaignId: mongoose.Types.ObjectId
): Promise<DocumentType<Campaign>> {
  const campaign = await getCampaignById(campaignId)
  // Send email if first publication (in the background)
  if (campaign.isArchived && !campaign.isReviewed) {
    sendNewCampaignEmail(campaign)
  }
  campaign.isArchived = !campaign.isArchived
  await campaign.save()
  return campaign
}

async function deleteCampaign(
  campaignId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<void> {
  // Get campaign and user from Mongo
  const campaign = await getCampaignById(campaignId)
  const user = await UserModel.findById(userId)
  // Only allow the owner or an admin to delete a campaign
  if (campaign.owner !== userId && !user.isAdmin) {
    throw new CustomError(401, errorNames.unauthorized)
  }
  // Only allow if the campaign isn't online
  if (campaign.isReviewed && !user.isAdmin) {
    throw new CustomError(401, errorNames.unauthorized)
  }
  // Delete all collabs linked to the campaign
  await CollabModel.deleteMany({ campaign: campaignId })
  // Actually delete the campaign
  await CampaignModel.deleteOne({ _id: campaign._id })
}

async function reviewCampaign(
  campaignId: mongoose.Types.ObjectId
): Promise<DocumentType<Campaign>> {
  const campaign = await getCampaignById(campaignId)
  campaign.isReviewed = true
  await campaign.save()
  return campaign
}

async function updateCampaignBrief(
  campaignId: mongoose.Types.ObjectId,
  updatedCampaign: CampaignBriefInput
): Promise<DocumentType<Campaign>> {
  // Check if campaign exists
  const campaign = await getCampaignById(campaignId)
  if (campaign == null) {
    throw new CustomError(400, errorNames.campaignNotFound)
  }

  // Save other settings
  campaign.goal = updatedCampaign.goal
  campaign.rules = updatedCampaign.rules
  campaign.estimatedBudget = updatedCampaign.estimatedBudget
  campaign.trackingProvider = updatedCampaign.trackingProvider
  campaign.publishingPlatforms = updatedCampaign.publishingPlatforms

  // Save and return populated campaign
  await campaign.save()
  return campaign
}

async function updateCampaignProduct(
  campaignId: mongoose.Types.ObjectId,
  updatedProduct: CampaignProduct
): Promise<DocumentType<Campaign>> {
  // Check if campaign exists
  const campaign = await getCampaignById(campaignId)
  if (campaign == null) {
    throw new CustomError(400, errorNames.campaignNotFound)
  }
  // Set updates
  campaign.product = updatedProduct
  campaign.markModified('product')
  // Save and return campaign
  await campaign.save()
  return campaign
}

async function updateCampaignTargetAudience(
  campaignId: mongoose.Types.ObjectId,
  updatedTarget: TargetAudience
): Promise<DocumentType<Campaign>> {
  // Check if campaign exists
  const campaign = await getCampaignById(campaignId)
  if (campaign == null) {
    throw new CustomError(400, errorNames.campaignNotFound)
  }
  // Set updates
  campaign.targetAudience = updatedTarget
  campaign.markModified('targetAudience')
  // Save and return campaign
  await campaign.save()
  return campaign
}

export async function notifyNewCampaignProposition(
  campaignId: mongoose.Types.ObjectId,
  creatorId: mongoose.Types.ObjectId,
  message: string,
  quote: number
): Promise<void> {
  // Fetch data that's needed in the email
  const campaign = await getCampaignById(campaignId)
  const creator = await CreatorModel.findById(creatorId)
  // Send the email
  await emailService.send({
    template: 'newCollabProposition',
    locals: {
      brandName: (campaign.brand as Brand).name,
      productName: campaign.product.name,
      username: creator.name,
      message,
      quote,
      dashboardLink: `${process.env.APP_URL}/brand/campaigns/${campaignId}/dashboard?tab=propositions`,
    },
    message: {
      from: 'Revolt Gaming <campaigns@revoltgaming.co>',
      to: campaign.owner,
    },
  })
}

// Fetch all campaigns (campaigns) with pagination
export async function getCreatorCampaignsPage(
  creatorId: mongoose.Types.ObjectId,
  page: number = 1
): Promise<PaginatedCampaignResponse> {
  const safePage = page < 1 ? 1 : page // Prevent page 0, starts at 1

  // Only active campaigns where the creator isn't in a collab
  const allCreatorCollabs = await CollabModel.find({ creator: creatorId })
  const allCollabsCampaignsIds = allCreatorCollabs.map(_collab => _collab.campaign)
  const query = { isReviewed: true, isArchived: false, _id: { $nin: allCollabsCampaignsIds } }

  // Promise to get paginated results
  const campaignsPromise = CampaignModel.find(query)
    .sort({ createdAt: -1 })
    .skip((safePage - 1) * CREATORS_CAMPAIGNS_PER_PAGE)
    .limit(CREATORS_CAMPAIGNS_PER_PAGE)
    .exec()
  // Promise to count all unpaginated results
  const totalResultsPromise = CampaignModel.find(query)
    .countDocuments()
    .exec()
  // Run results and results count in parallel
  const [campaigns, totalResults] = await Promise.all([campaignsPromise, totalResultsPromise])
  const totalPages = Math.ceil(totalResults / CREATORS_CAMPAIGNS_PER_PAGE)

  return { items: campaigns, totalPages, currentPage: page }
}

export {
  createCampaign,
  getCampaignById,
  getUserCampaigns,
  toggleArchiveCampaign,
  deleteCampaign,
  getAdminCampaigns,
  reviewCampaign,
  updateCampaignBrief,
  updateCampaignProduct,
  updateCampaignTargetAudience,
}
