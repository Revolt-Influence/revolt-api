import { mongoose } from '@hasezoey/typegoose'
import { Resolver, Query, Arg, Ctx, Mutation, Authorized } from 'type-graphql'
import { errorNames, CustomError } from '../../utils/errors'
import {
  createCampaign,
  getCampaignById,
  getUserCampaigns,
  toggleArchiveCampaign,
  deleteCampaign,
  reviewCampaign,
  updateCampaign,
} from '.'
import { Campaign, CampaignModel } from './model'
import { applyToExperience, getExperiencesPage } from '../creator/experiences'
import { Creator, CreatorStatus } from '../creator/model'
import { PaginatedResponse } from '../../resolvers/PaginatedResponse'
import { MyContext } from '../session/model'
import { AuthRole } from '../middleware/auth'

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

  @Authorized(AuthRole.USER)
  @Mutation(() => Campaign, { description: 'Create blank campaign' })
  async createCampaign(@Ctx() ctx: MyContext): Promise<Campaign> {
    const createdCampaign = await createCampaign(ctx.state.user.user._id)
    return createdCampaign
  }

  @Authorized(AuthRole.USER)
  @Mutation(() => Campaign, { description: 'Update existing campaign' })
  async updateCampaign(
    @Arg('campaignId') campaignId: string,
    @Arg('updatedCampaign') updatedCampaign: Campaign
  ): Promise<Campaign> {
    const savedCampaign = await updateCampaign(mongoose.Types.ObjectId(campaignId), updatedCampaign)
    return savedCampaign
  }

  @Authorized(AuthRole.USER)
  @Mutation(() => Campaign, { description: 'Switch isArchived status' })
  async toggleArchiveCampaign(@Arg('campaignId') campaignId: string): Promise<Campaign> {
    const updatedCampaign = await toggleArchiveCampaign(mongoose.Types.ObjectId(campaignId))
    return updatedCampaign
  }

  @Authorized(AuthRole.ADMIN)
  @Mutation(() => Campaign, { description: 'Admin only, allows campaign publication' })
  async reviewCampaign(@Arg('campaignId') campaignId: string): Promise<Campaign> {
    const updatedCampaign = await reviewCampaign(mongoose.Types.ObjectId(campaignId))
    return updatedCampaign
  }

  @Authorized(AuthRole.USER)
  @Mutation(() => String)
  async deleteCampaign(
    @Arg('campaignId') campaignId: string,
    @Ctx() ctx: MyContext
  ): Promise<string> {
    await deleteCampaign(mongoose.Types.ObjectId(campaignId), ctx.state.user.user._id)
    return `Deleted campaign ${campaignId}`
  }
}

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

export default CampaignResolver
