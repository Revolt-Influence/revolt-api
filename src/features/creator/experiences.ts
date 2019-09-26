import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { CampaignModel, Campaign } from '../campaign/model'
import { Collab, CollabModel, CollabProposition } from '../collab/model'
import { CustomError, errorNames } from '../../utils/errors'
import { getCampaignById } from '../campaign'
import { emailService } from '../../utils/emails'
import { getFullCreatorById } from '.'
import { getOrCreateConversationByParticipants, sendMessage } from '../conversation'
import { Brand } from '../brand/model'

// TODO: pagination
const EXPERIENCES_PER_PAGE = 11 // leave 1 card for ambassador program

// Fetch all experiences (campaigns) with pagination
async function getExperiencesPage(
  creatorId: string,
  page: number = 1
): Promise<{ experiences: DocumentType<Campaign>[]; totalPages: number }> {
  const safePage = page < 1 ? 1 : page // Prevent page 0, starts at 1

  // Only active experiences where the creator isn't in a collab
  const allCreatorCollabs = await CollabModel.find({ creator: creatorId })
  const allCollabsExperiencesIds = allCreatorCollabs.map(_collab => _collab.campaign)
  const query = { isReviewed: true, isArchived: false, _id: { $nin: allCollabsExperiencesIds } }

  // Promise to get paginated results
  const experiencesPromise = CampaignModel.find(query)
    .where('settings')
    .ne(null)
    .populate({
      path: 'settings.brand',
      model: 'Brand',
    })
    .select('_id name owner settings creationDate')
    .sort({ creationDate: 'descending' })
    .skip((safePage - 1) * EXPERIENCES_PER_PAGE)
    .limit(EXPERIENCES_PER_PAGE)
    .exec()
  // Promise to count all unpaginated results
  const totalResultsPromise = CampaignModel.find(query)
    .where('settings')
    .ne(null)
    .countDocuments()
    .exec()
  // Run results and results count in parallel
  const [experiences, totalResults] = await Promise.all([experiencesPromise, totalResultsPromise])
  const totalPages = Math.ceil(totalResults / EXPERIENCES_PER_PAGE)

  return { experiences, totalPages }
}

async function notifyNewCampaignProposition(
  experienceId: mongoose.Types.ObjectId,
  creatorId: mongoose.Types.ObjectId,
  proposition: CollabProposition
): Promise<void> {
  // Fetch data that's needed in the email
  const campaign = await getCampaignById(experienceId)
  const creator = await getFullCreatorById(creatorId)
  // Send the email
  await emailService.send({
    template: 'newCollabProposition',
    locals: {
      brandName: (campaign.settings.brand as Brand).name,
      campaignName: campaign.name,
      username: creator.name,
      message: proposition.message,
      dashboardLink: `${
        process.env[`APP_URL_${process.env.NODE_ENV.toUpperCase()}`]
      }/brand/campaigns/${experienceId}/dashboard/propositions`,
    },
    message: {
      from: 'Revolt <campaigns@revolt.club>',
      to: campaign.owner,
    },
  })
}

async function applyToExperience(
  experienceId: mongoose.Types.ObjectId,
  creatorId: mongoose.Types.ObjectId,
  proposition: CollabProposition
): Promise<DocumentType<Collab>> {
  // Check if creator hasn't already applied
  const maybeExistingCollab = await CollabModel.findOne({
    campaign: experienceId,
    creator: creatorId,
  })
  if (maybeExistingCollab != null) {
    throw new CustomError(400, errorNames.alreadyApplied)
  }
  // Find the collab brand
  const campaign = await CampaignModel.findById(experienceId)
  // Find or creator matching conversation
  const conversation = await getOrCreateConversationByParticipants(creatorId, campaign.settings
    .brand as mongoose.Types.ObjectId)
  // Send motivation message
  await sendMessage({
    conversationId: conversation._id,
    text: proposition.message,
    creatorAuthorId: creatorId,
    isAdminAuthor: false,
    isNotification: true,
  })
  // Actually create the collab
  const collab = new CollabModel({
    campaign: experienceId,
    creator: creatorId,
    status: 'proposed',
    deadline: null,
    proposition,
    conversation: conversation._id,
  } as Collab)
  await collab.save()

  // Notify the brand via email in the background (no async needed)
  notifyNewCampaignProposition(experienceId, creatorId, proposition)

  return collab
}

export { getExperiencesPage, applyToExperience }
