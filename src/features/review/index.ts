import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { Collab, CollabModel, CollabStatus } from '../collab/model'
import { Review, ReviewModel, ReviewFormat } from './model'
import { getCollabById } from '../collab'
import { CustomError, errorNames } from '../../utils/errors'
import { emailService } from '../../utils/emails'
import { CreatorModel, Creator } from '../creator/model'
import { getCampaignById } from '../campaign'
import { getVideoIdFromYoutubeUrl, getYoutubeVideoData } from '../youtuber'
import { Brand } from '../brand/model'
import { sendMessage } from '../conversation'

interface BaseReview {
  link: string
  format: ReviewFormat
  creatorId: mongoose.Types.ObjectId
}

async function getReviewById(reviewId: mongoose.Types.ObjectId): Promise<DocumentType<Review>> {
  const review = await ReviewModel.findById(reviewId)
  if (review == null) {
    throw new CustomError(400, errorNames.reviewNotFound)
  }
  return review
}

async function getReviewFromYoutubeVideoUrl(
  videoUrl: string,
  creatorId: mongoose.Types.ObjectId
): Promise<Partial<Review>> {
  const videoId = getVideoIdFromYoutubeUrl(videoUrl)
  const video = await getYoutubeVideoData(videoId)
  const now = Date.now()
  return {
    format: ReviewFormat.YOUTUBE_VIDEO,
    commentCount: video.commentCount,
    likeCount: video.likeCount,
    viewCount: video.viewCount,
    creator: creatorId,
    link: videoUrl,
    thumbnail: video.thumbnail,
  }
}

async function enrichReview(review: BaseReview): Promise<Review> {
  const { link, format, creatorId } = review
  switch (format) {
    case ReviewFormat.YOUTUBE_VIDEO:
      const video = await getReviewFromYoutubeVideoUrl(link, creatorId)
      return video as Review
    default:
      return null
  }
}

async function notifyReviewsSubmitted(collab: DocumentType<Collab>): Promise<void> {
  // Send an email to the brand
  const creator = await CreatorModel.findById(collab.creator)
  const campaign = await getCampaignById(collab.campaign as mongoose.Types.ObjectId)
  await emailService.send({
    template: 'newReviews',
    locals: {
      username: creator.name,
      brandName: (campaign.brand as Brand).name,
      productName: campaign.product.name,
      dashboardLink: `${process.env.APP_URL}/brand/campaigns/${campaign._id}/dashboard?tab=reviews`,
    },
    message: {
      from: 'Revolt <campaigns@revolt.club>',
      to: campaign.owner,
      replyTo: process.env.CAMPAIGN_MANAGER_EMAIL,
    },
  })
}

async function submitCreatorReview(
  collabId: string,
  review: Review
): Promise<DocumentType<Collab>> {
  // Find collab
  const collab = await getCollabById(collabId, 'creator')
  if (collab == null) {
    throw new CustomError(400, errorNames.collabNotFound)
  }

  // Find related campaign
  const campaign = await getCampaignById(collab.campaign as mongoose.Types.ObjectId)

  // Create review document
  const newReview = new ReviewModel(review)
  await newReview.save()

  // Add reviews to collab
  collab.review = newReview._id
  collab.status = CollabStatus.DONE
  await collab.save()

  const populatedCollab = (await CollabModel.populate(collab, {
    path: 'instagram',
    select: 'picture_url followers post_count username likes comments',
  })) as DocumentType<Collab>

  // Send notification email in the background
  notifyReviewsSubmitted(collab)

  // Send message in the background
  sendMessage({
    conversationId: collab.conversation as mongoose.Types.ObjectId,
    brandAuthorId: null,
    creatorAuthorId: null,
    isAdminAuthor: true,
    text: `🔥 ${(collab.creator as Creator).name} a posté ses revues pour la campagne ${
      campaign.product.name
    }`,
    isNotification: true,
  })
  return populatedCollab
}

export { submitCreatorReview, enrichReview, BaseReview, getReviewById }
