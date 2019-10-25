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
  FieldResolver,
  Root,
} from 'type-graphql'
import {
  changeCreatorPassword,
  createCreator,
  getCreatorsPage,
  saveCreatorProfile,
  setCreatorStatus,
  updateCreatorEmail,
  createStripeConnectedAccount,
  getCreatorStripeLoginLink,
  addReferredBrandEmail,
} from '.'
import { AuthRole } from '../../middleware/auth'
import { PaginatedResponse } from '../../resolvers/PaginatedResponse'
import { createDefaultSession, MyContext, Session, SessionType } from '../session/model'
import { User } from '../user/model'
import { linkYoutubeChannel } from '../youtuber'
import { Creator, CreatorModel, CreatorStatus, Language, GameCategory } from './model'
import { Youtuber, YoutuberModel } from '../youtuber/model'
import { createSessionId } from '../session'

const PaginatedCreatorResponse = PaginatedResponse(Creator)
type PaginatedCreatorResponse = InstanceType<typeof PaginatedCreatorResponse>

@InputType()
class SignupCreatorInput {
  @Field()
  email: string

  @Field({ description: 'Plain password, will be hashed on server' })
  password: string

  @Field()
  birthYear: number

  @Field(() => Language)
  language: string

  @Field(() => [GameCategory])
  categories: GameCategory[]

  @Field({ nullable: true, description: 'The ID of the creator who signed him up' })
  ambassador?: string
}

@Resolver(() => Creator)
class CreatorResolver {
  @Authorized(AuthRole.ADMIN)
  @Query(() => PaginatedCreatorResponse, {
    description: 'Get page of all signed up creators who linked a social network',
  })
  async creators(
    @Arg('page', { defaultValue: 1, nullable: true }) page?: number,
    @Arg('status', () => CreatorStatus, { nullable: true }) status?: CreatorStatus
  ): Promise<PaginatedCreatorResponse> {
    const paginatedCreators = await getCreatorsPage(page, true, status)
    return paginatedCreators
  }

  @Query(() => Creator, { nullable: true, description: 'Get specific creator by ID or email' })
  async creator(
    @Arg('id', { nullable: true }) id?: string,
    @Arg('email', { nullable: true }) email?: string
  ): Promise<Creator> {
    let creator: Creator = null
    if (id) {
      creator = await CreatorModel.findById(id)
    } else if (email) {
      creator = await CreatorModel.findOne({ email })
    }
    return creator
  }

  @Mutation(() => Session, { description: 'Signup a creator and start a session' })
  async signupCreator(
    @Arg('creator') creator: SignupCreatorInput,
    @Ctx() ctx: MyContext
  ): Promise<Session> {
    // Create user
    const createdCreator = await createCreator(creator)
    // Generate session ID to help Apollo Client cache data
    const sessionId = createSessionId(createdCreator._id)
    const newSessionData: Session = {
      sessionId,
      isLoggedIn: true,
      sessionType: SessionType.CREATOR,
      creator: createdCreator,
    }
    // Save session data in a cookie
    await ctx.login(newSessionData)
    // Send to client
    return newSessionData
  }

  @Authorized(AuthRole.CREATOR)
  @Mutation(() => Creator, { description: 'Change creator email' })
  async updateCreatorEmail(
    @Arg('newEmail') newEmail: string,
    @Ctx() ctx: MyContext
  ): Promise<Creator> {
    const updatedCreator = await updateCreatorEmail(ctx.state.user.creator._id, newEmail)
    return updatedCreator
  }

  @Authorized(AuthRole.CREATOR)
  @Mutation(() => Creator, { description: 'Set new creator username and/or profile picture' })
  async updateCreatorProfile(
    @Arg('newName') newName: string,
    @Arg('newPicture') newPicture: string,
    @Ctx() ctx: MyContext
  ): Promise<Creator> {
    const updatedCreator = await saveCreatorProfile(ctx.state.user.creator._id, {
      picture: newPicture,
      name: newName,
    })
    return updatedCreator
  }

  @Authorized(AuthRole.CREATOR)
  @Mutation(() => Creator, { description: 'Attach Youtube channel to a creator' })
  async attachCreatorYoutubeChannel(
    @Arg('youtubeCode') youtubeCode: string,
    @Ctx() ctx: MyContext
  ): Promise<Creator> {
    const updatedCreator = await linkYoutubeChannel(youtubeCode, ctx.state.user.creator._id)
    return updatedCreator
  }

  @Authorized(AuthRole.ADMIN)
  @Mutation(() => Creator, { description: 'Admin marks creator as verified or blocked' })
  async setCreatorStatus(
    @Arg('creatorId') creatorId: string,
    @Arg('newStatus', () => CreatorStatus) newStatus: CreatorStatus
  ): Promise<Creator> {
    const updatedCreator = await setCreatorStatus(mongoose.Types.ObjectId(creatorId), newStatus)
    return updatedCreator
  }

  @Authorized(AuthRole.CREATOR)
  @Mutation(() => Creator, { description: 'Change creator password' })
  async changeCreatorPassword(
    @Arg('currentPassword') currentPassword: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() ctx: MyContext
  ): Promise<Creator> {
    const updatedUser = await changeCreatorPassword({
      creatorId: ctx.state.user.creator._id,
      currentPassword,
      newPassword,
    })
    return updatedUser
  }

  @Authorized(AuthRole.CREATOR)
  @Mutation(() => Creator, { description: 'Create Stripe connected account from code' })
  async createStripeConnectedAccount(
    @Arg('code') code: string,
    @Ctx() ctx: MyContext
  ): Promise<Creator> {
    const updatedCreator = await createStripeConnectedAccount(code, ctx.state.user.creator._id)
    return updatedCreator
  }

  @Authorized(AuthRole.CREATOR)
  @Mutation(() => Creator, { description: 'Add a referred brand email' })
  async addReferredBrandEmail(
    @Arg('brandEmail') brandEmail: string,
    @Ctx() ctx: MyContext
  ): Promise<Creator> {
    const updatedCreator = await addReferredBrandEmail(ctx.state.user.creator._id, brandEmail)
    return updatedCreator
  }

  @FieldResolver()
  async youtube(@Root() creator: DocumentType<Creator>): Promise<Youtuber> {
    const youtube = await YoutuberModel.findById(creator.youtube)
    return youtube
  }

  @FieldResolver()
  async ambassador(@Root() creator: DocumentType<Creator>): Promise<Creator> {
    const ambassador = await CreatorModel.findById(creator.ambassador)
    return ambassador
  }

  @FieldResolver()
  hasConnectedStripe(@Root() creator: DocumentType<Creator>): boolean {
    return !!creator.stripeConnectedAccountId
  }

  @FieldResolver()
  async stripeLoginLink(@Root() creator: DocumentType<Creator>): Promise<string> {
    const loginLogin = await getCreatorStripeLoginLink(creator._id)
    return loginLogin
  }
}

export { CreatorResolver, SignupCreatorInput, PaginatedCreatorResponse }
