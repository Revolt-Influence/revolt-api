import { DocumentType, Ref, mongoose } from '@hasezoey/typegoose'
import { Conversation, ConversationModel, MessageModel, Message } from './model'
import { CustomError, errorNames } from '../../utils/errors'
import { UserModel, User } from '../user/model'
import { BrandModel, Brand } from '../brand/model'
import { Creator, CreatorModel } from '../creator/model'
import { emailService } from '../../utils/emails'

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

  // Return saved message
  return message
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
        }}/experiences/${conversation}`,
        message: text,
      },
      message: {
        from: 'Revolt <campaigns@revolt.club>',
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

interface PaginatedConversations {
  conversations: DocumentType<Conversation>[]
  totalPages: number
  currentPage: number
}

async function getConversationsPage(
  query: Partial<DocumentType<Conversation>>,
  page: number,
  populateFields: string
): Promise<PaginatedConversations> {
  const fullQuery = { ...query, isArchived: false }
  // Make sure page 0 doesn't exist
  const safePage = page < 1 ? 1 : page
  // Get just the conversations data we need
  const conversationsPromise = ConversationModel.find(fullQuery)
    .populate(populateFields)
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
    conversations,
  }
}

async function getCreatorConversations(
  creatorId: string,
  page: number
): Promise<PaginatedConversations> {
  return getConversationsPage(
    { creator: mongoose.Types.ObjectId(creatorId) },
    page,
    'messages brand messagesCount'
  )
}

async function getUserConversations(userId: string, page: number): Promise<PaginatedConversations> {
  // Get IDs of user brands
  const userBrands = await BrandModel.find({ users: userId }).select('_id')
  const userBrandsIds = userBrands.map(_userBrand => _userBrand._id)
  // Get conversations page
  return getConversationsPage(
    { brand: { $in: userBrandsIds } as any },
    page,
    'messages creator messagesCount'
  )
}

async function getAdminConversations(page: number): Promise<PaginatedConversations> {
  // Get all the conversations
  return getConversationsPage({}, page, 'messages brand creator messagesCount')
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
