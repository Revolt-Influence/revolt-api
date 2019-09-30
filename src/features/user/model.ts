import mongoose from 'mongoose'
import { prop, Ref, getModelForClass, modelOptions } from '@hasezoey/typegoose'
import { ObjectType, Field, ID, registerEnumType } from 'type-graphql'
import { Creator } from '../creator/model'

enum Plan {
  FREE = 'free',
  PREMIUM = 'premium',
}

registerEnumType(Plan, {
  name: 'Plan',
  description: 'Whether the user has paid or not',
})

@ObjectType({ description: 'A user is a signed up brand member' })
@modelOptions({ schemaOptions: { timestamps: true } })
class User {
  @Field(() => ID)
  _id: mongoose.Types.ObjectId

  @Field({ description: 'Used for login and notification and marketing emails' })
  @prop({ lowercase: true, trim: true })
  email: string

  @Field({ description: 'When the user switched to premium', nullable: true })
  @prop()
  switchedToPremiumAt?: Date

  @prop()
  password: string

  @Field(() => Plan, { description: 'Whether the user has paid' })
  @prop({ enum: Plan })
  plan: Plan

  @Field({ description: 'Got from Stripe, used to tell what card the user used', nullable: true })
  @prop()
  creditCardLast4?: string

  @Field({ description: 'Used to retrieve a Stripe customer when he gets back to Premium' })
  @prop()
  stripeCustomerId: string

  @prop()
  resetPasswordToken?: string

  @prop()
  resetPasswordExpiresAt?: Date

  @Field({ description: 'Only used to score the lead, not a relation' })
  @prop()
  company: string

  @Field({ description: 'Whether he works for Revolt' })
  @prop({ default: false })
  isAdmin: boolean

  @Field(() => Creator, { description: 'The creator who signed him up', nullable: true })
  @prop({ ref: Creator })
  ambassador?: Ref<Creator>

  @Field(() => Date)
  createdAt: Readonly<Date>

  @Field(() => Date)
  updatedAt: Readonly<Date>
}

const UserModel = getModelForClass(User)

export { User, UserModel, Plan }
