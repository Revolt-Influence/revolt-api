import * as Router from 'koa-router'
import { Context } from 'koa'
import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { errorNames } from '../../utils/errors'
import {
  getFullConversation,
  getCreatorConversations,
  getUserConversations,
  getAdminConversations,
  sendMessage,
} from '.'
import { UserModel, User } from '../user/model'
import { ISessionState, SessionType } from '../session'
import { Conversation, ConversationModel } from './model'
import { Brand, BrandModel } from '../brand/model'
import { Creator } from '../creator/model'
import { socketEvents } from '../../utils/sockets'

const router = new Router()

async function allowIfLoggedIn(ctx: Context, next: () => Promise<void>): Promise<void> {
  // Throw error if logged out
  if (ctx.isUnauthenticated()) {
    ctx.throw(401, errorNames.unauthorized)
  }
  // Continue if user is logged in
  await next()
}

router.use(allowIfLoggedIn)

router.get('/', async ctx => {
  const page = parseInt(ctx.query.page) || 1

  const { sessionType, ...user } = ctx.state.user as {
    sessionType: SessionType
    user: DocumentType<Creator> | DocumentType<User>
  }

  // Get all conversations whether creator, brand or admin
  const getConversations = () => {
    // Creators
    if (sessionType === 'creator') {
      return getCreatorConversations((user as any)._id, page)
    }
    // Brand users
    if ((user as any).plan !== 'admin') {
      return getUserConversations((user as any)._id, page)
    }
    // Admin users
    return getAdminConversations(page)
  }
  ctx.body = await getConversations()
})

router.get('/:conversationId', async ctx => {
  const conversation = await getFullConversation(ctx.params.conversationId)
  ctx.body = { conversation }
})

router.post('/:conversationId/message', async ctx => {
  const { text } = ctx.request.body as { text: string }
  const { conversationId } = ctx.params as { conversationId: string }
  const { sessionType, ...user } = ctx.state.user as {
    sessionType: SessionType
    user: DocumentType<Creator> | DocumentType<User>
  }
  const conversation = await ConversationModel.findById(conversationId)
  // Save message in database
  const sentMessage = await sendMessage({
    text,
    conversationId: mongoose.Types.ObjectId(conversationId),
    creatorAuthorId: sessionType === 'creator' ? (user as any)._id : null,
    isAdminAuthor: sessionType === 'brand' && (user as any).plan === 'admin',
    brandAuthorId:
      sessionType === 'brand' && (user as any).plan !== 'admin'
        ? (conversation.brand as mongoose.Types.ObjectId)
        : null,
    isNotification: false,
  })

  // Find all users that should be notified of the message (admins, brand users, creator)
  const admins = await UserModel.find({ plan: 'admin' }).select('_id')
  const adminsIds = admins.map(_admin => _admin._id)
  const brand = await BrandModel.findById(conversation.brand as mongoose.Types.ObjectId)
  const rooms = [conversation.creator as mongoose.Types.ObjectId, ...brand.users, ...adminsIds]

  // Emit message for each of these users
  rooms.forEach(_room => {
    ctx.io.sockets.to(_room).emit(socketEvents.NEW_MESSAGE, sentMessage)
  })

  ctx.body = 'Message sent'
})

export default router
