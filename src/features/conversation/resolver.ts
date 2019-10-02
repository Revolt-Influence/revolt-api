import Router from 'koa-router'
import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { Resolver, Query, Authorized, Ctx, Arg, Mutation } from 'type-graphql'
import { errorNames } from '../../utils/errors'
import {
  getFullConversation,
  getCreatorConversations,
  getUserConversations,
  getAdminConversations,
  sendMessage,
} from '.'
import { UserModel, User } from '../user/model'
import { Conversation, ConversationModel } from './model'
import { Brand, BrandModel } from '../brand/model'
import { Creator } from '../creator/model'
import { socketEvents } from '../../utils/sockets'
import { PaginatedResponse } from '../../resolvers/PaginatedResponse'
import { MyContext, SessionType } from '../session/model'

const PaginatedConversationResponse = PaginatedResponse(Conversation)
type PaginatedConversationResponse = InstanceType<typeof PaginatedConversationResponse>

@Resolver(() => Conversation)
class ConversationResolver {
  @Authorized()
  @Query(() => PaginatedConversationResponse, { description: 'Get conversations page' })
  async conversations(
    @Ctx() ctx: MyContext,
    @Arg('page', { defaultValue: 1, nullable: true }) page?: number
  ): Promise<PaginatedConversationResponse> {
    const getConversations = () => {
      // Creators
      if (ctx.state.user.sessionType === 'creator') {
        return getCreatorConversations(ctx.state.user.user._id, page)
      }
      // Brand users
      if (!ctx.state.user.user.isAdmin) {
        return getUserConversations(ctx.state.user.user._id, page)
      }
      // Admin users
      return getAdminConversations(page)
    }
    const conversations = getConversations()
    return conversations
  }

  @Authorized()
  @Query(() => Conversation, { description: 'Get conversation by ID' })
  async conversation(@Arg('id') id: string): Promise<Conversation> {
    const conversation = await ConversationModel.findById(id)
    return conversation
  }

  @Authorized()
  @Mutation(() => String)
  async sendMessage(
    @Arg('conversationId') conversationId: string,
    @Arg('text') text: string,
    @Ctx() ctx: MyContext
  ): Promise<string> {
    // Get conversation because we need the brand
    const conversation = await ConversationModel.findById(conversationId)
    // Gather all session data to tell if message is from creator and brand (maybe admin too)
    const { sessionType, user, creator } = ctx.state.user
    const sentMessage = await sendMessage({
      text,
      conversationId: mongoose.Types.ObjectId(conversationId),
      creatorAuthorId: sessionType === SessionType.CREATOR ? creator._id : null,
      isAdminAuthor: sessionType === SessionType.BRAND && user.isAdmin,
      brandAuthorId:
        sessionType === SessionType.BRAND && !user.isAdmin
          ? (conversation.brand as mongoose.Types.ObjectId)
          : null,
      isNotification: false,
    })

    // Find all users that should be notified of the message (admins, brand users, creator)
    const admins = await UserModel.find({ isAdmin: true } as Partial<User>).select('_id')
    const adminsIds = admins.map(_admin => _admin._id)
    const brand = await BrandModel.findById(conversation.brand as mongoose.Types.ObjectId)
    const rooms = [conversation.creator as mongoose.Types.ObjectId, ...brand.users, ...adminsIds]

    // Emit message for each of these users
    rooms.forEach(_room => {
      ctx.io.sockets.to(_room).emit(socketEvents.NEW_MESSAGE, sentMessage)
    })

    // No need to return the conversation since sockets will update the client
    return 'Message sent'
  }
}

export { ConversationResolver, PaginatedConversationResponse }
