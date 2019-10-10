import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { emailService } from '../../utils/emails'
import { CustomError, errorNames } from '../../utils/errors'
import { Brand, BrandModel } from '../brand/model'
import { CollabModel } from '../collab/model'
import { Creator } from '../creator/model'
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
    .sort({ creationDate: 'descending' })
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
      from: 'Revolt <campaigns@revolt.club>',
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
