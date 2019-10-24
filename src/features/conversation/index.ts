import { DocumentType, mongoose } from '@typegoose/typegoose'
import { emailService } from '../../utils/emails'
import { CustomError, errorNames } from '../../utils/errors'
import { Brand, BrandModel } from '../brand/model'
import { Creator, CreatorModel } from '../creator/model'
import { User, UserModel } from '../user/model'
import { Conversation, ConversationModel, Message, MessageModel } from './model'
import { PaginatedConversationResponse } from './resolver'
import { socketEvents } from '../../utils/sockets'

const CONVERSATIONS_PER_PAGE = 20

async function createConversation(
  creatorId: mongoose.Types.ObjectId,
  brandId: mongoose.Types.ObjectId
): Promise<DocumentType<Conversation>> {
  const conversationDraft: Partial<Conversation> = {
    creator: creatorId,
    brand: brandId,
    messages: [],
    messagesCount: 0,
    isArchived: false,
  }
  const conversation = new ConversationModel(conversationDraft)
  await conversation.save()
  return conversation
}

interface MessageOptions {
  conversationId: mongoose.Types.ObjectId
  text: string
  brandAuthorId?: mongoose.Types.ObjectId
  creatorAuthorId?: mongoose.Types.ObjectId
  isAdminAuthor: boolean
  isNotification: boolean
}
async function sendMessage({
  conversationId,
  text,
  brandAuthorId,
  creatorAuthorId,
  isAdminAuthor,
  isNotification,
}: MessageOptions): Promise<DocumentType<Message>> {
  // Check payload
  if (
    text == null ||
    text.length === 0 ||
    conversationId == null ||
    (brandAuthorId != null && creatorAuthorId != null) ||
    (isAdminAuthor && brandAuthorId != null) ||
    (isAdminAuthor && creatorAuthorId != null)
  ) {
    throw new CustomError(400, errorNames.invalidPayload)
  }

  // Prepare and save message
  const messageDraft: Partial<Message> = {
    conversation: conversationId,
    text,
    // Find the author
    creatorAuthor: creatorAuthorId,
    brandAuthor: brandAuthorId,
    isAdminAuthor: isAdminAuthor || false,
  }
  const message = new MessageModel(messageDraft)
  await message.save()

  if (!isNotification) {
    // Notify user that he got a non-automated message
    sendMessageEmailNotification(message)
    // Make sure the conversation is not marked as archived
    const conversation = await ConversationModel.findById(conversationId)
    if (conversation.isArchived) {
      conversation.isArchived = false
      await conversation.save()
    }
  }

  // Return saved message (populates are important since this does not go through the GQL schema)
  return MessageModel.findById(message._id).populate([
    { path: 'conversation', select: '_id' },
    { path: 'brandAuthor', select: '_id' },
    { path: 'creatorAuthor', select: '_id' },
  ])
}

async function sendMessageEmailNotification({
  isAdminAuthor,
  brandAuthor,
  text,
  creatorAuthor,
  conversation,
}: Message): Promise<void> {
  const getSenderUsername = async (): Promise<string> => {
    if (isAdminAuthor) {
      return 'Revolt'
    }
    if (brandAuthor != null) {
      const brand = await BrandModel.findById(brandAuthor)
      return brand.name
    }
    if (creatorAuthor != null) {
      const creator = await CreatorModel.findById(creatorAuthor)
      return creator.name
    }
  }
  const senderUsername = await getSenderUsername()
  const getRecipientsData = async (): Promise<{ name: string; email: string }[]> => {
    const fullConversation = await ConversationModel.findById(conversation).populate([
      {
        path: 'brand',
        populate: {
          path: 'users',
        },
      },
      { path: 'creator' },
    ])
    if (creatorAuthor != null) {
      // Send email to brand
      return ((fullConversation.brand as Brand).users as User[]).map(_user => ({
        name: (fullConversation.brand as Brand).name,
        email: _user.email,
      }))
    }
    if (brandAuthor != null) {
      // Send email to creator
      const { name, email } = fullConversation.creator as Creator
      return [{ name, email }]
    }
    if (isAdminAuthor) {
      return [
        // Send email to creator
        {
          name: (fullConversation.creator as Creator).name,
          email: (fullConversation.creator as Creator).email,
        },
        // Send email to brand
        ...((fullConversation.brand as Brand).users as User[]).map(_user => ({
          name: (fullConversation.brand as Brand).name,
          email: _user.email,
        })),
      ]
    }
  }
  const recipientsDatas = await getRecipientsData()

  // Send emails in parallel to each recipient
  const sendEmailsPromises = recipientsDatas.map(async _recipient =>
    emailService.send({
      template: 'newMessage',
      locals: {
        senderUsername,
        username: _recipient.name,
        conversationLink: `${process.env.APP_URL}/${
          creatorAuthor != null ? 'creator' : 'brand'
        }}/games/${conversation}`,
        message: text,
      },
      message: {
        from: 'Revolt Gaming <campaigns@revoltgaming.co>',
        to: _recipient.email,
      },
    })
  )
  await Promise.all(sendEmailsPromises)
}

async function getOrCreateConversationByParticipants(
  creatorId: mongoose.Types.ObjectId,
  brandId: mongoose.Types.ObjectId
): Promise<DocumentType<Conversation>> {
  // Check if conversation exists
  const maybeConversation = await ConversationModel.findOne({
    creator: creatorId,
    brand: brandId,
  })
  if (maybeConversation != null) {
    return maybeConversation
  }
  // Conversation does not exist, create it
  const newConversation = new ConversationModel({
    creator: creatorId,
    brand: brandId,
  } as Conversation)
  await newConversation.save()
  return newConversation
}

async function getFullConversation(conversationId: string): Promise<DocumentType<Conversation>> {
  const conversation = await ConversationModel.findById(conversationId).populate(
    'messages brand creator messagesCount'
  )
  if (conversation == null) {
    throw new CustomError(400, errorNames.conversationNotFound)
  }
  return conversation
}

async function getConversationsPage(
  query: Partial<DocumentType<Conversation>>,
  page: number
): Promise<PaginatedConversationResponse> {
  const fullQuery = { ...query, isArchived: false }
  // Make sure page 0 doesn't exist
  const safePage = page < 1 ? 1 : page
  // Get just the conversations data we need
  const conversationsPromise = ConversationModel.find(fullQuery)
    .skip((safePage - 1) * CONVERSATIONS_PER_PAGE)
    .limit(CONVERSATIONS_PER_PAGE)
    .exec()
  const conversationsCountPromise = ConversationModel.find(fullQuery)
    .countDocuments()
    .exec()
  // Execute both requests in parallel for better speed
  const [conversations, conversationsCount] = await Promise.all([
    conversationsPromise,
    conversationsCountPromise,
  ])
  return {
    currentPage: safePage,
    totalPages: Math.ceil(conversationsCount / CONVERSATIONS_PER_PAGE),
    items: conversations,
  }
}

async function getCreatorConversations(
  creatorId: mongoose.Types.ObjectId,
  page: number
): Promise<PaginatedConversationResponse> {
  return getConversationsPage({ creator: creatorId }, page)
}

async function getUserConversations(
  userId: mongoose.Types.ObjectId,
  page: number
): Promise<PaginatedConversationResponse> {
  // Get IDs of user brands
  const userBrands = await BrandModel.find({ users: userId }).select('_id')
  const userBrandsIds = userBrands.map(_userBrand => _userBrand._id)
  // Get conversations page
  return getConversationsPage({ brand: { $in: userBrandsIds } as any }, page)
}

async function getAdminConversations(page: number): Promise<PaginatedConversationResponse> {
  // Get all the conversations
  return getConversationsPage({}, page)
}

export async function emitMessageToSockets(
  io: SocketIO.Server,
  conversation: Conversation,
  sentMessage: Message
): Promise<void> {
  // Find all users that should be notified of the message (admins, brand users, creator)
  const admins = await UserModel.find({ isAdmin: true } as Partial<User>).select('_id')
  const adminsIds = admins.map(_admin => _admin._id)
  const brand = await BrandModel.findById(conversation.brand as mongoose.Types.ObjectId)
  const rooms = [conversation.creator as mongoose.Types.ObjectId, ...brand.users, ...adminsIds]
  const uniqueRooms = [...new Set(rooms)]

  // Emit message for each of these users
  uniqueRooms.forEach(_room => {
    io.sockets.to(_room).emit(socketEvents.NEW_MESSAGE, sentMessage)
  })
}

export {
  createConversation,
  sendMessage,
  getOrCreateConversationByParticipants,
  getFullConversation,
  getUserConversations,
  getAdminConversations,
  getCreatorConversations,
  MessageOptions,
}
