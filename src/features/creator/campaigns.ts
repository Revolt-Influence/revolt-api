import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { emailService } from '../../utils/emails'
import { CustomError, errorNames } from '../../utils/errors'
import { Brand } from '../brand/model'
import { getCampaignById } from '../campaign'
import { CampaignModel } from '../campaign/model'
import { PaginatedCampaignResponse } from '../campaign/resolver'
import { Collab, CollabModel, CollabStatus } from '../collab/model'
import { getOrCreateConversationByParticipants, sendMessage } from '../conversation'
import { CreatorModel, CreatorStatus } from './model'

// TODO: pagination
const CAMPAIGNS_PER_PAGE = 11 // leave 1 card for ambassador program

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
    .sort({ creationDate: 'descending' })
    .skip((safePage - 1) * CAMPAIGNS_PER_PAGE)
    .limit(CAMPAIGNS_PER_PAGE)
    .exec()
  // Promise to count all unpaginated results
  const totalResultsPromise = CampaignModel.find(query)
    .countDocuments()
    .exec()
  // Run results and results count in parallel
  const [campaigns, totalResults] = await Promise.all([campaignsPromise, totalResultsPromise])
  const totalPages = Math.ceil(totalResults / CAMPAIGNS_PER_PAGE)

  return { items: campaigns, totalPages, currentPage: page }
}

async function notifyNewCampaignProposition(
  campaignId: mongoose.Types.ObjectId,
  creatorId: mongoose.Types.ObjectId,
  message: string
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
      dashboardLink: `${process.env.APP_URL}/brand/campaigns/${campaignId}/dashboard?tab=propositions`,
    },
    message: {
      from: 'Revolt Gaming <campaigns@revoltgaming.co>',
      to: campaign.owner,
    },
  })
}

export async function applyToCampaign(
  campaignId: mongoose.Types.ObjectId,
  creatorId: mongoose.Types.ObjectId,
  message: string
): Promise<DocumentType<Collab>> {
  // Check if creator hasn't already applied
  const maybeExistingCollab = await CollabModel.findOne({
    campaign: campaignId,
    creator: creatorId,
  })
  if (maybeExistingCollab != null) {
    throw new CustomError(400, errorNames.alreadyApplied)
  }

  // Verify the creator is verified by an admin
  const creator = await CreatorModel.findById(creatorId)
  if (creator.status !== CreatorStatus.VERIFIED) {
    throw new Error(errorNames.unauthorized)
  }

  // Find the collab brand
  const campaign = await CampaignModel.findById(campaignId)
  // Find or creator matching conversation
  const conversation = await getOrCreateConversationByParticipants(
    creatorId,
    campaign.brand as mongoose.Types.ObjectId
  )
  // Send motivation message
  await sendMessage({
    conversationId: conversation._id,
    text: message,
    creatorAuthorId: creatorId,
    isAdminAuthor: false,
    isNotification: true,
  })
  // Actually create the collab
  const collab = new CollabModel({
    campaign: campaignId,
    creator: creatorId,
    status: CollabStatus.REQUEST,
    deadline: null,
    message,
    conversation: conversation._id,
  } as Partial<Collab>)
  await collab.save()

  // Notify the brand via email in the background (no async needed)
  notifyNewCampaignProposition(campaignId, creatorId, message)

  return collab
}
