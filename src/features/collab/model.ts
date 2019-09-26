import * as mongoose from 'mongoose'
import { prop, Ref, getModelForClass, arrayProp } from '@hasezoey/typegoose'
import { Campaign } from '../campaign/model'
import { CreatorModel, Creator, PostalAddress } from '../creator/model'
import { Review, ReviewFormat } from '../review/model'
import { ConversationModel, Conversation } from '../conversation/model'

enum DashboardAction {
  accept = 'accept',
  refuse = 'refuse',
  markAsSent = 'markAsSent',
}

class CollabProposition extends PostalAddress {
  @arrayProp({ enum: ReviewFormat, items: String })
  formats: ReviewFormat[]

  @prop()
  message: string
}

enum CollabStatus {
  proposed = 'proposed',
  accepted = 'accepted',
  sent = 'sent',
  refused = 'refused',
  done = 'done',
}

class Collab {
  @prop({ enum: CollabStatus, type: String })
  status: CollabStatus

  @prop({ ref: Creator })
  creator: Ref<Creator>

  @prop({ ref: Campaign })
  campaign: Ref<Campaign>

  @prop()
  deadline: number // Timestamp

  @prop({ _id: false })
  proposition: CollabProposition

  @prop({ default: Date.now })
  creationDate: number

  @prop()
  acceptedDate?: number

  @prop()
  refusedDate?: number

  @prop()
  sentDate?: number

  @prop()
  doneDate?: number

  @arrayProp({ itemsRef: Review })
  reviews: Ref<Review>[]

  @prop({ ref: Conversation })
  conversation: Ref<Conversation>
}

const CollabModel = getModelForClass(Collab)

export { DashboardAction, CollabProposition, CollabStatus, Collab, CollabModel }
