import * as Router from 'koa-router'
import { Context } from 'koa'
import { errorNames } from '../../utils/errors'
import { getCollabById, reviewCollab } from '.'
import { submitCreatorReviews, BaseReview, enrichAllReviews } from '../review'
import { DashboardAction } from './model'

const router = new Router()

router.post('/:collabId/review', async ctx => {
  // Make sure it's a brand or an admin
  if (ctx.state.user.sessionType !== 'brand') {
    ctx.throw(401, errorNames.unauthorized)
  }
  // Get the collab
  const { collabId } = ctx.params as { collabId: string }
  const { action } = ctx.request.body as { action: DashboardAction }
  const collab = await getCollabById(collabId, 'creator')
  // Save the brand's decision
  const updatedCollab = await reviewCollab(collab, action)
  ctx.body = { collab: updatedCollab }
})

router.post('/:collabId/creatorReviews', async ctx => {
  // Get the collab
  const { collabId } = ctx.params as { collabId: string }
  // Get and enrich base reviews data
  const { baseReviews } = ctx.request.body as { baseReviews: BaseReview[] }
  // Enrich and save non-story reviews
  const reviews = await enrichAllReviews(baseReviews)
  // Save reviews in collab
  const updatedCollab = await submitCreatorReviews(collabId, reviews)
  ctx.body = { collab: updatedCollab }
})

export default router
