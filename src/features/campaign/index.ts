import { mongoose, DocumentType } from '@hasezoey/typegoose'
import { Campaign, CampaignModel } from './model'
import { CustomError, errorNames } from '../../utils/errors'
import { CollabModel, Collab } from '../collab/model'
import { getCampaignCollabs } from '../collab'
import { flatten2dArray } from '../../utils/array'
import { emailService } from '../../utils/emails'
import { UserModel } from '../user/model'
import { Creator } from '../creator/model'
import { BrandModel, Brand } from '../brand/model'

const CAMPAIGNS_PER_PAGE = 1000 // TODO: real pagination for campaigns

async function createCampaign(owner: string): Promise<DocumentType<Campaign>> {
  // Prepare campaign
  const campaign = new CampaignModel({
    owner,
    name: 'Ma nouvelle campagne',
  })
  // Save campaign to database
  await campaign.save()
  return campaign
}

async function getCampaignById(
  campaignId: mongoose.Types.ObjectId
): Promise<DocumentType<Campaign>> {
  // Find the right campaign
  const campaign = await CampaignModel.findById(campaignId).populate({
    path: 'settings.brand',
    model: 'Brand',
  })
  // Check if exists
  if (campaign == null) {
    throw new CustomError(404, errorNames.campaignNotFound)
  }
  return campaign
}

async function getCampaignsFromQuery(
  query: any,
  page: number
): Promise<{ campaigns: DocumentType<Campaign>[]; totalPages: number }> {
  const campaignsPromise = CampaignModel.find(query)
    .sort({ creationDate: 'descending' })
    .populate({
      path: 'settings.brand',
      model: 'Brand',
    })
    .select('_id name owner creationDate settings isArchived isReviewed')
    .skip(page * CAMPAIGNS_PER_PAGE)
    .limit(CAMPAIGNS_PER_PAGE)
    .exec()
  const totalCountPromise = CampaignModel.find(query)
    .countDocuments()
    .exec()
  const [campaigns, totalCount] = await Promise.all([campaignsPromise, totalCountPromise])
  const totalPages = Math.ceil(totalCount / CAMPAIGNS_PER_PAGE)
  return { campaigns, totalPages }
}

async function getUserCampaigns(
  email: string,
  page: number = 0
): Promise<{ campaigns: DocumentType<Campaign>[]; totalPages: number }> {
  const query = { owner: email }
  return getCampaignsFromQuery(query, page)
}

async function getAdminCampaigns(email: string, page: number = 0) {
  const query = {
    $or: [{ owner: email }, { isArchived: false }, { isReviewed: true }] as Partial<Campaign>[],
  }
  return getCampaignsFromQuery(query, page)
}

async function getUserCampaignsAndCollabs(
  email: string,
  page: number = 0
): Promise<{
  campaigns: DocumentType<Campaign>[]
  collabs: DocumentType<Collab>[]
  totalPages: number
}> {
  const { isAdmin } = await UserModel.findOne({ email })
  const { campaigns, totalPages } = await (isAdmin
    ? getAdminCampaigns(email)
    : getUserCampaigns(email))
  const collabsPromises = campaigns.map(async _campaign => getCampaignCollabs(_campaign._id))
  const collabs = await Promise.all(collabsPromises)
  // Collabs is an array of arrays. We want a flat array
  const flatCollabs = flatten2dArray<DocumentType<Collab>>(collabs)
  return {
    campaigns,
    totalPages,
    collabs: flatCollabs,
  }
}

async function sendNewCampaignEmail(campaign: DocumentType<Campaign>): Promise<void> {
  const brandUser = await UserModel.findOne({ email: campaign.owner }).populate('ambassador')
  const ambassador = brandUser.ambassador as Creator
  await emailService.send({
    template: 'newCampaign',
    locals: {
      campaignName: campaign.name,
      dashboardLink: `${process.env.APP_URL}/brand/campaigns/${campaign._id}/dashboard?tab=brief`,
      brandName: (campaign.brand as DocumentType<Brand>).name,
      brandEmail: campaign.owner,
      ambassador: ambassador && ambassador.email,
      isPremium: brandUser.plan !== 'free',
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

async function saveCampaignSettings(
  campaignId: mongoose.Types.ObjectId,
  updatedCampaign: Campaign
): Promise<DocumentType<Campaign>> {
  // Check if campaign exists
  const campaign = await getCampaignById(campaignId)
  if (campaign == null) {
    throw new CustomError(400, errorNames.campaignNotFound)
  }

  // Separate brand from other settings since it's stored in another collection
  const { brand: updatedBrand } = updatedCampaign

  // Save other settings
  campaign.name = updatedCampaign.name

  // Check if the campaign already has an associated brand in Mongo
  const existingBrand = await BrandModel.findById(campaign.brand)
  if (existingBrand == null) {
    // Find campaign owner to link him to the brand
    const user = await UserModel.findOne({ email: campaign.owner })
    // Brand does not exist, create relation
    const newBrand = new BrandModel({
      ...(updatedBrand as Brand),
      isSignedUp: true,
      users: [user._id],
    } as Brand)
    await newBrand.save()
    campaign.brand = newBrand._id
  } else {
    // Brand already exists, update it
    Object.entries(updatedBrand).forEach(_entry => {
      const [key, value] = _entry
      existingBrand[key] = value
    })
    await existingBrand.save()
    campaign.brand = existingBrand._id
  }

  // Apply all settings changes
  campaign.description = updatedCampaign.description
  campaign.rules = updatedCampaign.rules
  campaign.product = updatedCampaign.product
  campaign.targetAudience = updatedCampaign.targetAudience

  // Save and return populated campaign
  await campaign.save()
  return getCampaignById(campaign._id)
}

export {
  createCampaign,
  getCampaignById,
  getUserCampaigns,
  getUserCampaignsAndCollabs,
  toggleArchiveCampaign,
  sendNewCampaignEmail,
  deleteCampaign,
  getAdminCampaigns,
  reviewCampaign,
  saveCampaignSettings,
}
