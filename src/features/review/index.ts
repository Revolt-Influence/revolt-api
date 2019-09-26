import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { Collab, CollabModel, CollabStatus } from '../collab/model'
import { Review, ReviewModel, ReviewFormat } from './model'
import { getCollabById } from '../collab'
import { CustomError, errorNames } from '../../utils/errors'
import { getInstagramPostReview } from '../influencer/crawler'
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
  instagramPostData: any
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
): Promise<Review> {
  const videoId = getVideoIdFromYoutubeUrl(videoUrl)
  const video = await getYoutubeVideoData(videoId)
  const now = Date.now()
  return {
    format: ReviewFormat.youtubeVideo,
    comments: video.commentCount,
    likes: video.likeCount,
    views: video.viewCount,
    creator: creatorId,
    lastUpdateDate: now,
    submitDate: now,
    link: videoUrl,
    medias: [video.thumbnail],
    postDate: video.publishedDate,
  }
}

async function enrichBaseReview(baseReview: BaseReview): Promise<Review> {
  const { link, format, creatorId, instagramPostData } = baseReview
  // TODO: fetch real data
  switch (format) {
    case 'Instagram post':
      const review = await getInstagramPostReview(link, creatorId, instagramPostData)
      return review
    case 'Youtube video':
      const video = await getReviewFromYoutubeVideoUrl(link, creatorId)
      return video
    case 'Instagram story':
      const now = Date.now()
      return {
        link,
        format,
        creator: creatorId,
        lastUpdateDate: now,
        postDate: now,
        submitDate: now,
        medias: [baseReview.link],
      }
    default:
      return null
  }
}

async function enrichAllReviews(
  baseReviews: BaseReview[],
  instagramPostData?: any
): Promise<Review[]> {
  // Enrich non story reviews
  const enrichReviewPromises = baseReviews.map(async _baseReview => enrichBaseReview(_baseReview))
  const reviews = await Promise.all(enrichReviewPromises)
  return reviews
}

async function notifyReviewsSubmitted(collab: DocumentType<Collab>): Promise<void> {
  // Send an email to the brand
  const creator = await CreatorModel.findById(collab.creator)
  const campaign = await getCampaignById(collab.campaign as mongoose.Types.ObjectId)
  await emailService.send({
    template: 'newReviews',
    locals: {
      username: creator.name,
      brandName: (campaign.settings.brand as Brand).name,
      productName: campaign.settings.gift.name,
      dashboardLink: `${
        process.env[`APP_URL_${process.env.NODE_ENV.toUpperCase()}`]
      }/brand/campaigns/${campaign._id}/dashboard?tab=reviews`,
    },
    message: {
      from: 'Revolt <campaigns@revolt.club>',
      to: campaign.owner,
      replyTo: process.env.CAMPAIGN_MANAGER_EMAIL,
    },
  })
}

async function submitCreatorReviews(
  collabId: string,
  reviews: Review[]
): Promise<DocumentType<Collab>> {
  // Find collab
  const collab = await getCollabById(collabId, 'creator')
  if (collab == null) {
    throw new CustomError(400, errorNames.collabNotFound)
  }

  // Find related campaign
  const campaign = await getCampaignById(collab.campaign as mongoose.Types.ObjectId)

  // Create review documents
  const createReviewsPromises = reviews.map(async _review => {
    const newReview = new ReviewModel(_review)
    await newReview.save()
    return newReview
  })
  const newReviews = await Promise.all(createReviewsPromises)
  const newReviewsIds = newReviews.map(_review => _review._id)

  // Add reviews to collab
  collab.reviews = newReviewsIds
  collab.status = CollabStatus.done
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
      campaign.name
    }`,
    isNotification: true,
  })
  return populatedCollab
}

async function updateInstagramReviewStats(
  reviewId: mongoose.Types.ObjectId,
  postData: any,
  creatorId: mongoose.Types.ObjectId
): Promise<DocumentType<Review>> {
  const review = await getReviewById(reviewId)
  const post = await getInstagramPostReview(review.link, creatorId, postData)
  // Save updated review data
  review.likes = post.likes
  review.comments = post.comments
  review.comments = post.comments
  review.views = post.views
  review.lastUpdateDate = Date.now()
  await review.save()
  return review
}

export {
  submitCreatorReviews,
  enrichAllReviews,
  BaseReview,
  getReviewById,
  updateInstagramReviewStats,
}
