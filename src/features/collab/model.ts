import { arrayProp, getModelForClass, modelOptions, prop, Ref } from '@hasezoey/typegoose'
import mongoose from 'mongoose'
import { Field, ID, ObjectType, registerEnumType } from 'type-graphql'
import { Campaign } from '../campaign/model'
import { Conversation } from '../conversation/model'
import { Creator } from '../creator/model'
import { Review } from '../review/model'

enum ReviewCollabDecision {
  ACCEPT = 'accept',
  DENY = 'deny',
  MARK_AS_SENT = 'markAsSent',
}
registerEnumType(ReviewCollabDecision, {
  name: 'ReviewCollabDecision',
  description: 'Whether a brand accepts a collab',
})

enum CollabStatus {
  REQUEST = 'request',
  ACCEPTED = 'accepted',
  SENT = 'sent',
  DENIED = 'denied',
  DONE = 'done',
}
registerEnumType(CollabStatus, {
  name: 'CollabStatus',
  description: 'The advancement of the campaign',
})

@ObjectType({
  description: 'A collab is a partnership between a creator and a brand to work on a campaign',
})
@modelOptions({ schemaOptions: { timestamps: true } })
class Collab {
  @Field(() => ID, { description: 'Mongoose generated ID' })
  readonly _id: mongoose.Types.ObjectId

  @Field(() => CollabStatus, { description: 'Advancement of the collab' })
  @prop({ enum: CollabStatus, type: String })
  status: CollabStatus

  @Field({ description: 'How much the influencer wants to be paid in USD' })
  @prop({ default: 0, min: 0 })
  quote: number

  @Field(() => Creator, { description: 'The creator working on the collab' })
  @prop({ ref: Creator })
  creator: Ref<Creator>

  @Field(() => Campaign, { description: 'The campaign the collab is a part of' })
  @prop({ ref: Campaign })
  campaign: Ref<Campaign>

  @Field({ description: "The creator's motivation message for the brand" })
  @prop()
  message: string

  @Field(() => Review, { description: 'Social media post made for the campaign' })
  @prop({ ref: Review })
  review: Ref<Review>

  @Field(() => Conversation, { description: 'Conv where collab brand and creator can chat' })
  @prop({ ref: Conversation })
  conversation: Ref<Conversation>

  @Field(() => Date)
  createdAt: Readonly<Date>

  @Field(() => Date)
  updatedAt: Readonly<Date>
}

const CollabModel = getModelForClass(Collab)

export { ReviewCollabDecision, CollabStatus, Collab, CollabModel }
