import { mongoose, DocumentType } from '@typegoose/typegoose'
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
  FieldResolver,
  Root,
} from 'type-graphql'
import {
  createCampaign,
  deleteCampaign,
  getUserCampaigns,
  reviewCampaign,
  toggleArchiveCampaign,
  updateCampaignBrief,
  updateCampaignProduct,
  updateCampaignTargetAudience,
  getAdminCampaigns,
  getCreatorCampaignsPage,
} from '.'
import { AuthRole } from '../../middleware/auth'
import { PaginatedResponse } from '../../resolvers/PaginatedResponse'
import { Brand, BrandModel } from '../brand/model'
import { MyContext, SessionType } from '../session/model'
import {
  Campaign,
  CampaignModel,
  CampaignProduct,
  TargetAudience,
  TrackingProvider,
  PublishingPlatform,
} from './model'
import { User, UserModel } from '../user/model'
import { CollabModel, Collab } from '../collab/model'
import { Review, ReviewModel } from '../review/model'

const PaginatedCampaignResponse = PaginatedResponse(Campaign)
export type PaginatedCampaignResponse = InstanceType<typeof PaginatedCampaignResponse>

@InputType()
export class CreateCampaignInput {
  @Field({ description: 'Product name' })
  productName: string

  @Field({ description: 'Product landing page' })
  website: string

  @Field({ description: 'Name of the brand to create' })
  brandName: string
}

@InputType()
export class CampaignBriefInput implements Partial<Campaign> {
  @Field({ deprecationReason: 'Too annoying to write for brands', nullable: true })
  goal?: string

  @Field(() => [String])
  rules: string[]

  @Field({ nullable: true })
  estimatedBudget: number

  @Field(() => TrackingProvider)
  trackingProvider: TrackingProvider

  @Field(() => [PublishingPlatform])
  publishingPlatforms: PublishingPlatform[]
}

@Resolver(() => Campaign)
export class CampaignResolver {
  @Authorized()
  @Query(() => PaginatedCampaignResponse, {
    description: 'Get page of campaigns, different if brand or a user',
  })
  async campaigns(
    @Ctx() ctx: MyContext,
    @Arg('page', { defaultValue: 1, nullable: true }) page?: number
  ): Promise<PaginatedCampaignResponse> {
    if (ctx.state.user.sessionType === SessionType.BRAND) {
      // Show brand campaigns
      const { user } = ctx.state.user
      if (user.isAdmin) {
        // Show all campaigns to admins
        return getAdminCampaigns(user._id)
      }
      // Normal user campaigns
      return getUserCampaigns(user._id)
    }
    // Show creator campaigns
    const paginatedCreatorCollabs = await getCreatorCampaignsPage(ctx.state.user.creator._id, page)
    return paginatedCreatorCollabs
  }

  @Query(() => Campaign, { description: 'Get campaign by ID' })
  async campaign(@Arg('id') id: string): Promise<Campaign> {
    const campaign = CampaignModel.findById(id)
    return campaign
  }

  @Authorized(AuthRole.USER)
  @Mutation(() => Campaign, { description: 'Create blank campaign' })
  async createCampaign(
    @Ctx() ctx: MyContext,
    @Arg('campaignData') campaignData: CreateCampaignInput
  ): Promise<Campaign> {
    const createdCampaign = await createCampaign(ctx.state.user.user._id, campaignData)
    return createdCampaign
  }

  @Authorized(AuthRole.USER)
  @Mutation(() => Campaign, { description: 'Update existing campaign name, description or rules' })
  async updateCampaignBrief(
    @Arg('campaignId') campaignId: string,
    @Arg('campaignBrief') campaignBrief: CampaignBriefInput
  ): Promise<Campaign> {
    const savedCampaign = await updateCampaignBrief(
      mongoose.Types.ObjectId(campaignId),
      campaignBrief
    )
    return savedCampaign
  }

  @Authorized(AuthRole.USER)
  @Mutation(() => Campaign, { description: 'Edit the product that the campaign promotes' })
  async updateCampaignProduct(
    @Arg('campaignId') campaignId: string,
    @Arg('campaignProduct') campaignProduct: CampaignProduct
  ): Promise<Campaign> {
    const savedCampaign = await updateCampaignProduct(
      mongoose.Types.ObjectId(campaignId),
      campaignProduct
    )
    return savedCampaign
  }

  @Authorized(AuthRole.USER)
  @Mutation(() => Campaign, { description: 'Change the audience that a campaign should reach' })
  async updateCampaignTargetAudience(
    @Arg('campaignId') campaignId: string,
    @Arg('targetAudience') targetAudience: TargetAudience
  ): Promise<Campaign> {
    const savedCampaign = await updateCampaignTargetAudience(
      mongoose.Types.ObjectId(campaignId),
      targetAudience
    )
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

  @FieldResolver()
  async owner(@Root() campaign: DocumentType<Campaign>): Promise<User> {
    const owner = await UserModel.findById(campaign.owner)
    return owner
  }

  @FieldResolver()
  async brand(@Root() campaign: DocumentType<Campaign>): Promise<Brand> {
    const brand = await BrandModel.findById(campaign.brand)
    return brand
  }

  @FieldResolver()
  async collabs(@Root() campaign: DocumentType<Campaign>): Promise<Collab[]> {
    const collabs = await CollabModel.find({ campaign: campaign._id })
    return collabs
  }

  @FieldResolver()
  async reviews(@Root() campaign: DocumentType<Campaign>): Promise<Review[]> {
    const collabs = await CollabModel.find({ campaign: campaign._id })
    const reviewIds = collabs
      .filter(_collab => _collab.review != null)
      .map(_collab => _collab.review)
    const reviews = await ReviewModel.find()
      .where('_id')
      .in(reviewIds)
    return reviews
  }
}
