import { mongoose } from '@hasezoey/typegoose'
import {
  Arg,
  Authorized,
  Ctx,
  Field,
  InputType,
  Mutation,
  Query,
  Resolver,
  ObjectType,
} from 'type-graphql'
import {
  createCampaign,
  deleteCampaign,
  getUserCampaigns,
  reviewCampaign,
  toggleArchiveCampaign,
  updateCampaign,
} from '.'
import { AuthRole } from '../../middleware/auth'
import { PaginatedResponse } from '../../resolvers/PaginatedResponse'
import { Brand } from '../brand/model'
import { getExperiencesPage } from '../creator/experiences'
import { MyContext } from '../session/model'
import { Campaign, CampaignModel, CampaignProduct, TargetAudience } from './model'

const PaginatedCampaignResponse = PaginatedResponse(Campaign)
type PaginatedCampaignResponse = InstanceType<typeof PaginatedCampaignResponse>

@InputType()
class CampaignUpdateInput implements Partial<Campaign> {
  @Field(() => Brand)
  brand: Brand

  @Field()
  description: string

  @Field()
  name: string

  @Field(() => CampaignProduct)
  product: CampaignProduct

  @Field(() => [String])
  rules: string[]

  @Field(() => TargetAudience)
  targetAudience: TargetAudience
}

@Resolver()
class CampaignResolver {
  @Authorized()
  @Query(() => PaginatedCampaignResponse, {
    description:
      'Get page of campaigns or experiences depending on whether the session is a brand or a user',
  })
  async campaigns(
    @Ctx() ctx: MyContext,
    @Arg('page', { defaultValue: 1, nullable: true }) page?: number
  ): Promise<PaginatedCampaignResponse> {
    if (ctx.state.user.sessionType === 'brand') {
      // Show brand campaigns
      const paginatedCampaigns = await getUserCampaigns(ctx.state.user.user._id)
      return paginatedCampaigns
    }
    // Show creator experiences
    const paginatedExperiences = await getExperiencesPage(ctx.state.user.creator._id, page)
    return paginatedExperiences
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
    @Arg('updatedCampaign') updatedCampaign: CampaignUpdateInput
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

export { CampaignResolver, PaginatedCampaignResponse, CampaignUpdateInput }
