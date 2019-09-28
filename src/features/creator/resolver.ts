import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { Resolver, Mutation, Arg, Ctx, InputType, Field, Authorized, Query } from 'type-graphql'
import { Creator, CreatorModel, CreatorStatus, Gender } from './model'
import {
  getFullCreatorById,
  saveCreatorProfile,
  updateCreatorContactInfo,
  getCreatorsPage,
  setCreatorStatus,
  createCreator,
} from '.'
import { getExperiencesPage } from './experiences'
import { Session, MyContext, SessionType, createDefaultSession } from '../session/model'
import { linkYoutubeChannel } from '../youtuber'
import { errorNames, CustomError } from '../../utils/errors'
import { AuthRole } from '../../middleware/auth'
import { PaginatedResponse } from '../../resolvers/PaginatedResponse'

const PaginatedCreatorResponse = PaginatedResponse(Creator)
type PaginatedCreatorResponse = InstanceType<typeof PaginatedCreatorResponse>

@InputType()
class SignupCreatorInput implements Partial<Creator> {
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

  @Query(() => Creator, { description: 'Get specific creator' })
  async creator(@Arg('id') id: string): Promise<Creator> {
    const creator = await getFullCreatorById(mongoose.Types.ObjectId(id))
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
}

export { CreatorResolver, SignupCreatorInput, PaginatedCreatorResponse }
