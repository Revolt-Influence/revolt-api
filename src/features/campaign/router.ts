import * as Router from 'koa-router'
import { Context } from 'koa'
import { mongoose } from '@hasezoey/typegoose'
import { errorNames, CustomError } from '../../utils/errors'
import {
  createCampaign,
  getCampaignById,
  getUserCampaigns,
  toggleArchiveCampaign,
  deleteCampaign,
  reviewCampaign,
  saveCampaignSettings,
} from '.'
import { Campaign } from './model'
import { applyToExperience, getExperiencesPage } from '../creator/experiences'
import { CollabProposition } from '../collab/model'
import { Creator, CreatorStatus } from '../creator/model'

const router = new Router()

async function allowIfLoggedIn(ctx: Context, next: () => Promise<void>): Promise<void> {
  // Throw error if not admin
  if (ctx.isUnauthenticated()) {
    ctx.throw(401, errorNames.unauthorized)
  }
  // Continue if user is logged in
  await next()
}

function checkIfPremium(ctx: Context) {
  // Throw an error if not premium or admin
  if (ctx.isUnauthenticated() || ctx.state.user.plan === 'free') {
    ctx.throw(401, errorNames.unauthorized)
  }
}

// Restrict all routes to logged in only
router.use(allowIfLoggedIn)

router.get('/', async ctx => {
  const page = ctx.query.page || 0
  if (ctx.state.user.sessionType === 'brand') {
    // Show brand campaigns
    const userCampaigns = await getUserCampaigns(ctx.state.user.email)
    ctx.body = { campaigns: userCampaigns, currentPage: page }
  } else {
    // Show creator experiences
    const { experiences } = await getExperiencesPage(ctx.state.user._id, page)
    ctx.body = { campaigns: experiences, currentPage: page }
  }
})

router.get('/:campaignId', async ctx => {
  const { campaignId } = ctx.params as { campaignId: string }
  const campaign = await getCampaignById(mongoose.Types.ObjectId(campaignId))
  ctx.body = { campaign }
})

router.post('/', async ctx => {
  const { email } = ctx.state.user
  const createdCampaign = await createCampaign(email)
  ctx.body = { campaign: createdCampaign }
})

router.post('/:campaignId/settings', async ctx => {
  const { newCampaign } = ctx.request.body as {
    newCampaign: Campaign
  }
  const { campaignId } = ctx.params as { campaignId: string }
  const updatedCampaign = await saveCampaignSettings(
    mongoose.Types.ObjectId(campaignId),
    newCampaign
  )
  // Return new campaign
  ctx.body = { campaign: updatedCampaign }
})

router.post('/:campaignId/toggleArchive', async ctx => {
  // Send the invites
  const { campaignId } = ctx.params as { campaignId: string }
  const updatedCampaign = await toggleArchiveCampaign(mongoose.Types.ObjectId(campaignId))
  ctx.body = { campaign: updatedCampaign }
})

router.post('/:campaignId/apply', async ctx => {
  const { campaignId } = ctx.params as { campaignId: string }
  const { proposition } = ctx.request.body as { proposition: CollabProposition }
  // Make sure it's a verified influencer
  if (
    ctx.state.user.sessionType !== 'creator' ||
    (ctx.state.user as Creator).status !== CreatorStatus.verified
  ) {
    ctx.throw(401, errorNames.unauthorized)
  }
  const createdCollab = await applyToExperience(
    mongoose.Types.ObjectId(campaignId),
    ctx.state.user._id,
    proposition
  )
  ctx.body = { collab: createdCollab }
})

router.post('/:campaignId/review', async ctx => {
  const { campaignId } = ctx.params as { campaignId: string }
  // Only for admin
  if (ctx.isUnauthenticated() || ctx.state.user.plan !== 'admin') {
    throw new CustomError(401, errorNames.unauthorized)
  }
  const updatedCampaign = await reviewCampaign(mongoose.Types.ObjectId(campaignId))
  ctx.body = { campaign: updatedCampaign }
})

router.delete('/:campaignId', async ctx => {
  const { campaignId } = ctx.params as { campaignId: string }
  const { email } = ctx.state.user
  await deleteCampaign(mongoose.Types.ObjectId(campaignId), email)
  ctx.body = { campaignId }
})

export default router
