import mongoose from 'mongoose'
import { prop, Ref, getModelForClass, arrayProp, modelOptions } from '@hasezoey/typegoose'
import { registerEnumType, ObjectType, Field, ID } from 'type-graphql'
import { Campaign } from '../campaign/model'
import { CreatorModel, Creator } from '../creator/model'
import { Review, ReviewFormat } from '../review/model'
import { ConversationModel, Conversation } from '../conversation/model'

enum ReviewCollabDecision {
  ACCEPT = 'accept',
  REFUSE = 'refuse',
  MARK_AS_SENT = 'markAsSent',
}

enum CollabStatus {
  APPLIED = 'applied',
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
  @Field(type => ID, { description: 'Mongoose generated ID' })
  readonly _id: mongoose.Types.ObjectId

  @Field(() => CollabStatus, { description: 'Advancement of the collab' })
  @prop({ enum: CollabStatus, type: String })
  status: CollabStatus

  @Field(() => Creator, { description: 'The creator working on the collab' })
  @prop({ ref: Creator })
  creator: Ref<Creator>

  @Field(() => Campaign, { description: 'The campaign the collab is a part of' })
  @prop({ ref: Campaign })
  campaign: Ref<Campaign>

  @Field({ description: "The creator's motivation message for the brand" })
  @prop()
  message: string

  @arrayProp({ itemsRef: Review })
  reviews: Ref<Review>[]

  @prop({ ref: Conversation })
  conversation: Ref<Conversation>

  @Field(() => Date)
  createdAt: Readonly<Date>

  @Field(() => Date)
  updatedAt: Readonly<Date>
}

const CollabModel = getModelForClass(Collab)

export { ReviewCollabDecision, CollabStatus, Collab, CollabModel }
