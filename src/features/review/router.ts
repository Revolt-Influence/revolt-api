import * as Router from 'koa-router'
import { mongoose } from '@hasezoey/typegoose'
import { updateInstagramReviewStats } from '.'

const router = new Router()

// Update existing review stats
router.patch('/:reviewId', async ctx => {
  const { reviewId } = ctx.params as { reviewId: string }
  const { postData, creatorId } = ctx.request.body as { postData: any; creatorId: string }
  const updatedReview = await updateInstagramReviewStats(
    mongoose.Types.ObjectId(reviewId),
    postData,
    mongoose.Types.ObjectId(creatorId)
  )
  ctx.body = { review: updatedReview }
})

export default router
