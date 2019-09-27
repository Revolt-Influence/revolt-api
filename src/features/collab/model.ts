import * as mongoose from 'mongoose'
import { prop, Ref, getModelForClass, arrayProp, modelOptions } from '@hasezoey/typegoose'
import { registerEnumType, ObjectType, Field } from 'type-graphql'
import { Campaign } from '../campaign/model'
import { CreatorModel, Creator } from '../creator/model'
import { Review, ReviewFormat } from '../review/model'
import { ConversationModel, Conversation } from '../conversation/model'

enum DashboardAction {
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

  @Field()
  createdAt: Readonly<Date>

  @Field()
  updatedAt: Readonly<Date>
}

const CollabModel = getModelForClass(Collab)

export { DashboardAction, CollabStatus, Collab, CollabModel }
