import { DocumentType, mongoose } from '@typegoose/typegoose'
import { google, youtube_v3 } from 'googleapis'
import { Collab, CollabModel, CollabStatus } from '../collab/model'
import { Review, ReviewModel, ReviewFormat, ReviewStats, ReviewStatsModel } from './model'
import { getCollabById } from '../collab'
import { CustomError, errorNames } from '../../utils/errors'
import { emailService } from '../../utils/emails'
import { CreatorModel, Creator } from '../creator/model'
import { getCampaignById } from '../campaign'
import { getVideoIdFromYoutubeUrl, getYoutubeVideoData } from '../youtuber'
import { Brand } from '../brand/model'
import { sendMessage } from '../conversation'
import { getTrackedLinkClicksCount } from '../collab/tracking'
import { throttle, removeTimeFromDate } from '../../utils/time'
import { CampaignModel } from '../campaign/model'
import { tryPayCreatorQuote } from '../user'

const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY })

export interface BaseReview {
  link: string
  format: ReviewFormat
  creatorId: mongoose.Types.ObjectId
}

interface ReviewData {
  review: Partial<Review>
  stats: Partial<ReviewStats>
}

export async function getReviewById(
  reviewId: mongoose.Types.ObjectId
): Promise<DocumentType<Review>> {
  const review = await ReviewModel.findById(reviewId)
  if (review == null) {
    throw new CustomError(400, errorNames.reviewNotFound)
  }
  return review
}

async function getReviewFromYoutubeVideoUrl(
  videoUrl: string,
  creatorId: mongoose.Types.ObjectId
): Promise<ReviewData> {
  const videoId = getVideoIdFromYoutubeUrl(videoUrl)
  const video = await getYoutubeVideoData(videoId)
  const now = Date.now()

  const stats = {
    commentCount: video.commentCount,
    likeCount: video.likeCount,
    viewCount: video.viewCount,
  } as Partial<ReviewStats>

  const review = {
    format: ReviewFormat.YOUTUBE_VIDEO,
    creator: creatorId,
    link: videoUrl,
    thumbnail: video.thumbnail,
    platformId: videoId,
  } as Partial<Review>
  return { stats, review }
}

export async function enrichReview(review: BaseReview): Promise<ReviewData> {
  const { link, format, creatorId } = review
  switch (format) {
    case ReviewFormat.YOUTUBE_VIDEO:
      // Get both the review and its stats
      const reviewData = await getReviewFromYoutubeVideoUrl(link, creatorId)
      return reviewData
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
      from: 'Revolt Gaming <campaigns@revoltgaming.co>',
      to: campaign.owner,
      replyTo: process.env.CAMPAIGN_MANAGER_EMAIL,
    },
  })
}

export async function submitCreatorReview(
  collabId: string,
  reviewData: ReviewData
): Promise<DocumentType<Collab>> {
  // Find collab
  const collab = await getCollabById(collabId, 'creator')
  if (collab == null) {
    throw new CustomError(400, errorNames.collabNotFound)
  }

  // Find related campaign
  const campaign = await getCampaignById(collab.campaign as mongoose.Types.ObjectId)

  // Create review document
  const newReview = new ReviewModel(reviewData.review)
  await newReview.save()

  // Create stats document and link it to the review
  const stats = new ReviewStatsModel({ ...reviewData.stats, review: newReview._id } as Partial<
    ReviewStats
  >)
  await stats.save()

  // Add reviews to collab
  collab.review = newReview._id
  collab.status = CollabStatus.DONE
  await collab.save()

  const populatedCollab = (await CollabModel.populate(collab, {
    path: 'instagram',
    select: 'picture_url followers post_count username likes comments',
  })) as DocumentType<Collab>

  // Try to pay the creator in the background
  tryPayCreatorQuote(collabId)

  // Send notification email in the background
  notifyReviewsSubmitted(collab)

  // Send message in the background
  const sentMessage = await sendMessage({
    conversationId: collab.conversation as mongoose.Types.ObjectId,
    brandAuthorId: null,
    creatorAuthorId: null,
    isAdminAuthor: true,
    text: `🔥 ${(collab.creator as Creator).name} has posted his review of ${
      campaign.product.name
    }`,
    isNotification: true,
  })
  return populatedCollab
}

export async function saveNewReviewStats(review: DocumentType<Review>): Promise<Review> {
  // Get associated collab
  const collab = await CollabModel.findOne({ review: review._id })

  // Acutally update stats
  if (review.format === ReviewFormat.YOUTUBE_VIDEO) {
    // Get Youtube video stats
    const videoData = await youtube.videos.list({ id: review.platformId, part: 'statistics' })
    const { commentCount, likeCount, viewCount } = videoData.data.items[0].statistics

    const linkClicksCount = await getTrackedLinkClicksCount(collab.trackedLink)

    // Save new stats object
    const stats = new ReviewStatsModel({
      review: review._id,
      commentCount: parseInt(commentCount),
      likeCount: parseInt(likeCount),
      viewCount: parseInt(viewCount),
      linkClicksCount,
    } as Partial<ReviewStats>)
    await stats.save()

    return review
  }
}

export async function saveAllReviewsNewStats(): Promise<{
  updatedCount: number
  failedReviews: string[]
}> {
  // Get all reviews
  const reviews = await ReviewModel.find()
  // Count errors and success
  const failedReviews: mongoose.Types.ObjectId[] = []
  let updatedCount = 0
  // Use reduce to execute promises asynchronously
  // For more details read https://css-tricks.com/why-using-reduce-to-sequentially-resolve-promises-works/
  const allPromises = reviews.reduce(async (previousPromise, _review) => {
    try {
      await previousPromise
      updatedCount += 1
    } catch (error) {
      failedReviews.push(_review._id)
      console.log(`Could not update stats for review ${_review._id}`, error)
    }
    // Throttle to prevent getting blacklisted from external services
    await throttle(2000)
    // Actual promise, gets resolve on next iteration
    return saveNewReviewStats(_review)
  }, Promise.resolve(null))

  await allPromises

  // Return updated count
  return {
    failedReviews: failedReviews.map(_review => (_review as any).toString()),
    updatedCount,
  }
}

export function arrangeReviewStats(
  stats: DocumentType<ReviewStats>[]
): DocumentType<ReviewStats>[] {
  // Use createdAt (not updatedAt) to arrange stats
  const statsWithoutTime = stats.map(_stat => ({
    ..._stat,
    createdAt: removeTimeFromDate(_stat.createdAt as Date),
  }))
  // Keep just one per day, using the last one
  const uniqueDayStats = statsWithoutTime.reduce((keptStats: ReviewStats[], _stat) => {
    // Check if array includes a value from that day
    const alreadyThere = keptStats.some(
      _keptStat =>
        // Need valueOf() because date equality doesn't work in JS
        _keptStat.createdAt.valueOf() === _stat.createdAt.valueOf()
    )
    if (alreadyThere) {
      return keptStats
    }
    // Keep stat if it wasn't added
    return [...keptStats, { ..._stat, linkClicksCount: _stat.linkClicksCount || 0 }]
  }, [])
  // Restore createdAt time data from updatedAt key
  const fullUniqueStats = uniqueDayStats.map(_stat => ({ ..._stat, createdAt: _stat.updatedAt }))
  return fullUniqueStats as DocumentType<ReviewStats>[]
}
