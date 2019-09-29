import { mongoose } from '@hasezoey/typegoose'
import { Arg, Authorized, Ctx, Field, InputType, Mutation, Query, Resolver } from 'type-graphql'
import {
  changeCreatorPassword,
  createCreator,
  getCreatorsPage,
  saveCreatorProfile,
  setCreatorStatus,
  updateCreatorContactInfo,
} from '.'
import { AuthRole } from '../../middleware/auth'
import { PaginatedResponse } from '../../resolvers/PaginatedResponse'
import { createDefaultSession, MyContext, Session, SessionType } from '../session/model'
import { User } from '../user/model'
import { linkYoutubeChannel } from '../youtuber'
import { Creator, CreatorModel, CreatorStatus, Gender } from './model'

const PaginatedCreatorResponse = PaginatedResponse(Creator)
type PaginatedCreatorResponse = InstanceType<typeof PaginatedCreatorResponse>

@InputType()
class SignupCreatorInput {
  @Field()
  email: string

  @Field({ description: 'Plain password, will be hashed on server' })
  password: string

  @Field()
  phone: string

  @Field()
  birthYear: number

  @Field(() => Gender)
  gender: Gender

  @Field()
  country: string

  @Field()
  language: string

  @Field({ nullable: true, description: 'The ID of the creator who signed him up' })
  ambassador?: string
}

@Resolver()
class CreatorResolver {
  @Authorized(AuthRole.ADMIN)
  @Query(() => PaginatedCreatorResponse, {
    description: 'Get page of all signed up creators who linked a social network',
  })
  async creators(
    @Arg('page', { defaultValue: 1, nullable: true }) page?: number,
    @Arg('status', { nullable: true }) status?: CreatorStatus
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

  @Mutation(() => Creator, { description: 'Signup a creator and start a session' })
  async signupUser(@Arg('user') user: SignupCreatorInput, @Ctx() ctx: MyContext): Promise<Session> {
    // Create user
    const createdCreator = await createCreator(user)
    // Check if a session already exists to keep its ID to update Apollo Client cache
    const sessionId = ctx.state.user.sessionId || createDefaultSession().sessionId
    const newSessionData: Session = {
      sessionId,
      isLoggedIn: true,
      sessionType: SessionType.BRAND,
      creator: createdCreator,
    }
    // Save session data in a cookie
    await ctx.login(newSessionData)
    // Send to client
    return newSessionData
  }

  @Authorized(AuthRole.CREATOR)
  @Mutation(() => Creator, { description: 'Change creator email and/or phone' })
  async updateCreatorContactInfo(
    @Arg('newEmail') newEmail: string,
    @Arg('newPhone') newPhone: string,
    @Ctx() ctx: MyContext
  ): Promise<Creator> {
    const updatedCreator = await updateCreatorContactInfo(
      ctx.state.user.creator._id,
      newEmail,
      newPhone
    )
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
    @Arg('newStatus') newStatus: CreatorStatus
  ): Promise<Creator> {
    const updatedCreator = await setCreatorStatus(mongoose.Types.ObjectId(creatorId), newStatus)
    return updatedCreator
  }

  @Authorized(AuthRole.CREATOR)
  @Mutation(() => User, { description: 'Change creator password' })
  async changeUserPassword(
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
}

export { CreatorResolver, SignupCreatorInput, PaginatedCreatorResponse }
