import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { DashboardAction, Collab, CollabModel, CollabStatus } from './model'
import { CustomError, errorNames } from '../../utils/errors'
import { Creator } from '../creator/model'
import { emailService } from '../../utils/emails'
import { getCampaignById } from '../campaign'
import { Brand } from '../brand/model'
import { sendMessage, MessageOptions } from '../conversation'
import { ConversationModel } from '../conversation/model'

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

async function notifyCollabAccepted(collab: DocumentType<Collab>): Promise<void> {
  const campaign = await getCampaignById(collab.campaign as mongoose.Types.ObjectId)
  await emailService.send({
    template: 'collabAccepted',
    locals: {
      brandName: (campaign.settings.brand as Brand).name,
      username: (collab.creator as Creator).name,
      campaignName: campaign.name,
      productName: campaign.settings.gift.name,
      collabLink: `${process.env.APP_URL}/creator/experiences/${collab._id}`,
    },
    message: {
      from: 'Revolt <campaigns@revolt.club>',
      to: (collab.creator as Creator).email,
    },
  })
}

async function notifyCollabRefused(collab: DocumentType<Collab>): Promise<void> {
  const campaign = await getCampaignById(collab.campaign as mongoose.Types.ObjectId)
  await emailService.send({
    template: 'collabRefused',
    locals: {
      brandName: (campaign.settings.brand as Brand).name,
      username: (collab.creator as Creator).instagramUsername,
      campaignName: campaign.name,
    },
    message: {
      from: 'Revolt <campaigns@revolt.club>',
      to: (collab.creator as Creator).email,
    },
  })
}

async function reviewCollab(
  collab: DocumentType<Collab>,
  action: DashboardAction
): Promise<DocumentType<Collab>> {
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
    case 'accept':
      // Send an email to the creator in the background
      notifyCollabAccepted(collab)
      // Send message in the background
      sendMessage({
        ...messageOptions,
        text: `✅ ${
          (relatedCampaign.settings.brand as Brand).name
        } a accepté la collab pour la campagne "${relatedCampaign.name}"`,
      })
      // Mark as accepted
      collab.acceptedDate = now
      collab.status = CollabStatus.accepted
      break
    case 'refuse':
      // Send an email to the creator in the background
      notifyCollabRefused(collab)
      // Archive the conversation
      const conversation = await ConversationModel.findById(collab.conversation)
      conversation.isArchived = true
      await conversation.save()
      // Send message in the background
      sendMessage({
        ...messageOptions,
        text: `😞 ${
          (relatedCampaign.settings.brand as Brand).name
        } a refusé la collab pour la campagne "${relatedCampaign.name}"`,
      })
      collab.refusedDate = now
      collab.status = CollabStatus.refused
      break
    case 'markAsSent':
      collab.sentDate = now
      collab.status = CollabStatus.sent
      // Send message in the background
      sendMessage({
        ...messageOptions,
        text: `🎁 ${(relatedCampaign.settings.brand as Brand).name} a envoyé le produit ${
          relatedCampaign.settings.gift.name
        }`,
      })
      break
    default:
      break
    // Should not happen, but added just in case
  }

  const updatedCollab = await collab.save()
  const populatedUpdatedCollab = await CollabModel.findById(updatedCollab._id).populate({
    path: 'creator',
    select: 'email phone birthday gender country name picture',
    populate: [
      {
        path: 'instagram',
        select: 'picture_url followers post_count username likes comments',
      },
      {
        path: 'youtube',
      },
    ],
  })
  return populatedUpdatedCollab
}

async function getCampaignCollabs(campaignId: string): Promise<DocumentType<Collab>[]> {
  const collabs = await CollabModel.find({ campaign: campaignId }).populate([
    {
      path: 'creator',
      select: 'email phone birthday gender country name picture',
      populate: [
        {
          path: 'instagram',
          select: 'picture_url followers post_count username likes comments',
        },
        {
          path: 'youtube',
        },
      ],
    },
    { path: 'reviews' },
  ])
  return collabs
}

async function getCreatorCollabs(creatorId: string): Promise<DocumentType<Collab>[]> {
  const collabs = await CollabModel.find({ creator: creatorId })
    .where('status')
    .ne('refused')
    .populate('reviews')
  return collabs
}

export { getCollabById, reviewCollab, getCampaignCollabs, getCreatorCollabs }
