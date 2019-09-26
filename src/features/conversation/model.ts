import * as mongoose from 'mongoose'
import { prop, Ref, modelOptions, getModelForClass, arrayProp } from '@hasezoey/typegoose'
import { UserModel } from '../user/model'
import { Creator } from '../creator/model'
import { Brand } from '../brand/model'

@modelOptions({
  schemaOptions: { toJSON: { virtuals: true }, toObject: { virtuals: true } },
})
class Conversation {
  @prop({ ref: Brand })
  brand: Ref<Brand>

  @prop({ ref: Creator })
  creator: Ref<Creator>

  @prop({ default: Date.now })
  creationDate: number

  @prop({ default: true })
  isArchived: boolean

  @arrayProp({
    itemsRef: 'Message',
    ref: 'Message', // Shouldn't be here
    localField: '_id',
    foreignField: 'conversation',
    justOne: false,
    // TODO: pagination instead of arbitrary limit
    options: { sort: { sentAt: -1 }, limit: 50 },
  })
  messages: Ref<Message>[]

  @prop({
    ref: 'Message',
    localField: '_id',
    foreignField: 'conversation',
    count: true,
  })
  messagesCount: number
}

const ConversationModel = getModelForClass(Conversation)

class Message {
  @prop()
  text: string

  @prop({ ref: Brand })
  brandAuthor: Ref<Brand> // id

  @prop({ ref: Creator })
  creatorAuthor: Ref<Creator> // id

  @prop()
  isAdminAuthor: boolean

  @prop({ default: Date.now })
  sentAt: number

  @prop({ ref: Conversation })
  conversation: Ref<Conversation> // id
}

const MessageModel = getModelForClass(Message)

export { ConversationModel, Conversation, MessageModel, Message }
