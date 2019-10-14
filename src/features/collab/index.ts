import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { ReviewCollabDecision, Collab, CollabModel, CollabStatus } from './model'
import { CustomError, errorNames } from '../../utils/errors'
import { Creator, CreatorModel, CreatorStatus } from '../creator/model'
import { emailService } from '../../utils/emails'
import { getCampaignById, notifyNewCampaignProposition } from '../campaign'
import { Brand } from '../brand/model'
import { sendMessage, MessageOptions, getOrCreateConversationByParticipants } from '../conversation'
import { ConversationModel } from '../conversation/model'
import { CampaignModel } from '../campaign/model'

async function getCollabById(
  collabId: string,
  populateKey?: 'creator' | 'campaign'
): Promise<DocumentType<Collab>> {
  let collab: DocumentType<Collab> = null
  if (populateKey == null) {
    collab = await CollabModel.findById(collabId)
  } else {
    collab = await CollabModel.findById(collabId).populate(populateKey)
  }
  if (collab == null) {
    throw new CustomError(404, errorNames.collabNotFound)
  }
  return collab
}

export async function applyToCampaign(
  campaignId: mongoose.Types.ObjectId,
  creatorId: mongoose.Types.ObjectId,
  message: string,
  quote: number
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
    quote,
    conversation: conversation._id,
  } as Partial<Collab>)
  await collab.save()

  // Notify the brand via email in the background (no async needed)
  notifyNewCampaignProposition(campaignId, creatorId, message)

  return collab
}

async function notifyCollabAccepted(collab: DocumentType<Collab>): Promise<void> {
  const campaign = await getCampaignById(collab.campaign as mongoose.Types.ObjectId)
  await emailService.send({
    template: 'collabAccepted',
    locals: {
      brandName: (campaign.brand as Brand).name,
      username: (collab.creator as Creator).name,
      productName: campaign.product.name,
      collabLink: `${process.env.APP_URL}/creator/games/${collab._id}`,
    },
    message: {
      from: 'Revolt Gaming <campaigns@revoltgaming.co>',
      to: (collab.creator as Creator).email,
    },
  })
}

async function notifyCollabDenied(collab: DocumentType<Collab>): Promise<void> {
  const campaign = await getCampaignById(collab.campaign as mongoose.Types.ObjectId)
  await emailService.send({
    template: 'collabRefused',
    locals: {
      brandName: (campaign.brand as Brand).name,
      username: (collab.creator as Creator).name,
      productName: campaign.product.name,
    },
    message: {
      from: 'Revolt Gaming <campaigns@revoltgaming.co>',
      to: (collab.creator as Creator).email,
    },
  })
}

async function reviewCollab(
  collabId: mongoose.Types.ObjectId,
  action: ReviewCollabDecision
): Promise<DocumentType<Collab>> {
  const collab = await CollabModel.findById(collabId).populate('creator campaign')
  // Common options for all the messages about to be sent
  const messageOptions: MessageOptions = {
    conversationId: collab.conversation as mongoose.Types.ObjectId,
    isAdminAuthor: true,
    brandAuthorId: null,
    creatorAuthorId: null,
    text: '',
    isNotification: true,
  }

  // Get related campaign details so we can create meaningful notification messages
  const relatedCampaign = await getCampaignById(collab.campaign as mongoose.Types.ObjectId)

  // Act based on the brand's decision
  const now = Date.now()
  switch (action) {
    case ReviewCollabDecision.ACCEPT:
      // Send an email to the creator in the background
      notifyCollabAccepted(collab)
      // Send message in the background
      sendMessage({
        ...messageOptions,
        text: `✅ ${
          (relatedCampaign.brand as Brand).name
        } has accepted your collab request for the game "${relatedCampaign.product.name}"`,
      })
      // Mark as accepted
      collab.status = CollabStatus.ACCEPTED
      break
    case ReviewCollabDecision.DENY:
      // Send an email to the creator in the background
      notifyCollabDenied(collab)
      // Archive the conversation
      const conversation = await ConversationModel.findById(collab.conversation)
      conversation.isArchived = true
      await conversation.save()
      // Send message in the background
      sendMessage({
        ...messageOptions,
        text: `😞 ${
          (relatedCampaign.brand as Brand).name
        } has denied your collab request for the game "${relatedCampaign.product.name}"`,
      })
      collab.status = CollabStatus.DENIED
      break
    case ReviewCollabDecision.MARK_AS_SENT:
      collab.status = CollabStatus.SENT
      // Send message in the background
      sendMessage({
        ...messageOptions,
        text: `🎁 ${(relatedCampaign.brand as Brand).name} has sent the game ${
          relatedCampaign.product.name
        }`,
      })
      break
    default:
      break
    // Should not happen, but added just in case
  }

  await collab.save()
  return collab
}

async function getCampaignCollabs(
  campaignId: mongoose.Types.ObjectId
): Promise<DocumentType<Collab>[]> {
  const collabs = await CollabModel.find({ campaign: campaignId })
  return collabs
}

async function getCreatorCollabs(
  creatorId: mongoose.Types.ObjectId
): Promise<DocumentType<Collab>[]> {
  const collabs = await CollabModel.find({ creator: creatorId })
    .where('status')
    .ne('refused')
  return collabs
}

export { getCollabById, reviewCollab, getCampaignCollabs, getCreatorCollabs }
