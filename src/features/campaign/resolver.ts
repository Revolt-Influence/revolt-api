import { mongoose } from '@hasezoey/typegoose'
import { Resolver, Query, Arg, Ctx, Mutation } from 'type-graphql'
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
import { Campaign, CampaignModel } from './model'
import { applyToExperience, getExperiencesPage } from '../creator/experiences'
import { Creator, CreatorStatus } from '../creator/model'
import { PaginatedResponse } from '../../resolvers/PaginatedResponse'

const PaginatedCampaignResponse = PaginatedResponse(Campaign)
type PaginatedCampaignResponse = InstanceType<typeof PaginatedCampaignResponse>

@Resolver()
class CampaignResolver {
  @Query(() => PaginatedCampaignResponse, {
    description:
      'Get page of campaigns or experiences depending on whether the session is a brand or a user',
  })
  async campaigns(
    @Ctx() ctx: any,
    @Arg('page', { defaultValue: 1, nullable: true }) page?: number
  ): Promise<PaginatedCampaignResponse> {
    if (ctx.state.user.sessionType === 'brand') {
      // Show brand campaigns
      const paginatedCampaigns = await getUserCampaigns(ctx.state.user.email)
      return {
        items: paginatedCampaigns.campaigns,
        currentPage: page,
        totalPages: paginatedCampaigns.totalPages,
      }
    }
    // Show creator experiences
    const paginatedExperiences = await getExperiencesPage(ctx.state.user._id, page)
    return {
      items: paginatedExperiences.experiences,
      currentPage: page,
      totalPages: paginatedExperiences.totalPages,
    }
  }

  @Query(() => Campaign, { description: 'Get campaign by ID' })
  async campaign(@Arg('id') id: string): Promise<Campaign> {
    const campaign = CampaignModel.findById(id)
    return campaign
  }

  @Mutation({ description: 'Create blank campaign' })
  async createCampaign()
}

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
  const { message } = ctx.request.body as { message: string }
  // Make sure it's a verified creator
  if (
    ctx.state.user.sessionType !== 'creator' ||
    (ctx.state.user as Creator).status !== CreatorStatus.VERIFIED
  ) {
    ctx.throw(401, errorNames.unauthorized)
  }
  const createdCollab = await applyToExperience(
    mongoose.Types.ObjectId(campaignId),
    ctx.state.user._id,
    message
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

export default CampaignResolver
