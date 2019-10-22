import Router from 'koa-router'
import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { Resolver, Query, Authorized, Ctx, Arg, Mutation, FieldResolver, Root } from 'type-graphql'
import { errorNames } from '../../utils/errors'
import {
  getFullConversation,
  getCreatorConversations,
  getUserConversations,
  getAdminConversations,
  sendMessage,
  emitMessageToSockets,
} from '.'
import { UserModel, User } from '../user/model'
import { Conversation, ConversationModel, Message, MessageModel } from './model'
import { Brand, BrandModel } from '../brand/model'
import { Creator, CreatorModel } from '../creator/model'
import { socketEvents } from '../../utils/sockets'
import { PaginatedResponse } from '../../resolvers/PaginatedResponse'
import { MyContext, SessionType } from '../session/model'
import { CollabModel, Collab } from '../collab/model'

const PaginatedConversationResponse = PaginatedResponse(Conversation)
type PaginatedConversationResponse = InstanceType<typeof PaginatedConversationResponse>

@Resolver(() => Message)
class MessageResolver {
  @FieldResolver()
  async brandAuthor(@Root() message: DocumentType<Message>): Promise<Brand> {
    const brand = await BrandModel.findById(message.brandAuthor)
    return brand
  }

  @FieldResolver()
  async creatorAuthor(@Root() message: DocumentType<Message>): Promise<Creator> {
    const creator = await CreatorModel.findById(message.creatorAuthor)
    return creator
  }

  @FieldResolver()
  async conversation(@Root() message: DocumentType<Message>): Promise<Conversation> {
    const conversation = await ConversationModel.findById(message.conversation)
    return conversation
  }
}

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
      if (ctx.state.user.sessionType === SessionType.CREATOR) {
        return getCreatorConversations(ctx.state.user.creator._id, page)
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

    await emitMessageToSockets(ctx.io, conversation, sentMessage)

    // No need to return the conversation since sockets will update the client
    return 'Message sent'
  }

  @FieldResolver()
  async brand(@Root() conversation: DocumentType<Conversation>): Promise<Brand> {
    const brand = await BrandModel.findById(conversation.brand)
    return brand
  }

  @FieldResolver()
  async creator(@Root() conversation: DocumentType<Conversation>): Promise<Creator> {
    const creator = await CreatorModel.findById(conversation.creator)
    return creator
  }

  @FieldResolver()
  async messages(@Root() conversation: DocumentType<Conversation>): Promise<Message[]> {
    // TODO: pagination instead of arbitrary limit
    const messages = await MessageModel.find({ conversation: conversation._id })
      .sort({ sentAt: -1 })
      .limit(50)
    return messages
  }

  @FieldResolver()
  async messagesCount(@Root() conversation: DocumentType<Conversation>): Promise<number> {
    const messagesCount = await MessageModel.find({ conversation: conversation._id }).count()
    return messagesCount
  }

  @FieldResolver(() => [Collab])
  async collabs(@Root() conversation: DocumentType<Conversation>): Promise<Collab[]> {
    const collabs = await CollabModel.find({ conversation: conversation._id })
    return collabs
  }
}

export { ConversationResolver, PaginatedConversationResponse, MessageResolver }
