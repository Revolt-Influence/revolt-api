import mongoose from 'mongoose'
import { prop, Ref, getModelForClass, modelOptions } from '@typegoose/typegoose'
import { ObjectType, Field, ID, registerEnumType, Authorized } from 'type-graphql'
import { Creator } from '../creator/model'
import { AuthRole } from '../../middleware/auth'

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
  @prop({ enum: Plan, default: Plan.FREE })
  plan: Plan

  @prop()
  stripeCustomerId?: string

  @Field({ description: 'Whether the user has entered a payment method' })
  hasPaymentMethod: boolean

  @Authorized(AuthRole.USER)
  @Field({ description: 'Last digits of the saved credit card', nullable: true })
  creditCardLast4?: string

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

  @Field({ description: 'Only created for Premium users', nullable: true })
  @prop()
  firstName?: string

  @Field({ description: 'Only created for Premium users', nullable: true })
  @prop()
  lastName?: string

  @Field(() => Date)
  createdAt: Readonly<Date>

  @Field(() => Date)
  updatedAt: Readonly<Date>
}

const UserModel = getModelForClass(User)

export { User, UserModel, Plan }
