import { arrayProp, getModelForClass, modelOptions, prop, Ref } from '@typegoose/typegoose'
import mongoose from 'mongoose'
import { Field, ID, ObjectType } from 'type-graphql'
import { Brand } from '../brand/model'
import { Creator } from '../creator/model'

@ObjectType({
  description: 'Conversation between a brand, a creator and Revolt. Linked to one ore more collabs',
})
@modelOptions({
  schemaOptions: { toJSON: { virtuals: true }, toObject: { virtuals: true }, timestamps: true },
})
class Conversation {
  @Field(() => ID, { description: 'Mongoose generated ID' })
  readonly _id: mongoose.Types.ObjectId

  @Field(() => Brand, { description: 'Brand that talks to a creator' })
  @prop({ ref: Brand })
  brand: Ref<Brand>

  @Field(() => Creator, { description: 'Creator that talks to a brand' })
  @prop({ ref: Creator })
  creator: Ref<Creator>

  @Field({ description: 'Whether the conversation should appear in the messages page' })
  @prop({ default: true })
  isArchived: boolean

  @Field(() => [Message], { description: 'Conversation messages from old to new' })
  @arrayProp({
    itemsRef: 'Message',
    ref: 'Message',
    localField: '_id',
    foreignField: 'conversation',
    justOne: false,
    // TODO: pagination instead of arbitrary limit
    options: { sort: { sentAt: -1 }, limit: 50 },
  })
  messages: Ref<Message>[]

  @Field({ description: 'How many messages are in the conversation' })
  @prop({
    ref: 'Message',
    localField: '_id',
    foreignField: 'conversation',
    count: true,
  })
  messagesCount: number

  @Field(() => Date)
  createdAt: Readonly<Date>

  @Field(() => Date)
  updatedAt: Readonly<Date>
}

const ConversationModel = getModelForClass(Conversation)

@ObjectType({ description: 'A message is part of a conversation' })
@modelOptions({ schemaOptions: { timestamps: true } })
class Message {
  @Field(() => ID, { description: 'Mongoose generated ID' })
  readonly _id: mongoose.Types.ObjectId

  @Field({ description: 'The content of the message' })
  @prop()
  text: string

  @Field(() => Brand, { description: 'Potential brand author', nullable: true })
  @prop({ ref: Brand })
  brandAuthor?: Ref<Brand> // id

  @Field(() => Creator, { description: 'Potential creator author', nullable: true })
  @prop({ ref: Creator })
  creatorAuthor?: Ref<Creator> // id

  @Field({ description: 'Whether the message was sent by an admin or is a notification' })
  @prop()
  isAdminAuthor: boolean

  @Field(() => Conversation, { description: 'The conversation the message is a part of' })
  @prop({ ref: Conversation })
  conversation: Ref<Conversation> // id

  @Field(() => Date)
  createdAt: Readonly<Date>

  @Field(() => Date)
  updatedAt: Readonly<Date>
}

const MessageModel = getModelForClass(Message)

export { ConversationModel, Conversation, MessageModel, Message }
