import * as mongoose from 'mongoose'
import { prop, Ref, getModelForClass, modelOptions } from '@hasezoey/typegoose'
import { Creator } from '../creator/model'

enum Plan {
  free = 'free',
  premium = 'premium',
  admin = 'admin',
}

class User {
  @prop({ lowercase: true, trim: true })
  email: string

  @prop({ default: Date.now })
  signupDate: number

  @prop({ default: false })
  hasVerifiedEmail?: boolean

  @prop()
  verifyEmailToken?: string

  @prop()
  switchToPremiumDate: number

  @prop()
  phone: string

  @prop()
  passwordHash: string

  @prop({ enum: Plan })
  plan: Plan

  @prop()
  creditCardLast4: string

  @prop()
  customerId: string

  @prop()
  resetPasswordToken: string

  @prop()
  resetPasswordExpires: number

  @prop()
  company: string

  @prop()
  wantsHelp: string

  @prop({ ref: Creator })
  ambassador?: Ref<Creator>
}

const UserModel = getModelForClass(User)

export { User, UserModel, Plan }
