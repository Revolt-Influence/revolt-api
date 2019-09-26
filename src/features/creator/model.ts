import * as mongoose from 'mongoose'
import { prop, Ref, getModelForClass } from '@hasezoey/typegoose'
import { YoutuberModel, Youtuber } from '../youtuber/model'

enum CreatorStatus {
  unverified = 'unverified',
  verified = 'verified',
  blocked = 'blocked',
}

enum Gender {
  male = 'male',
  female = 'female',
}

class PostalAddress {
  @prop()
  firstName: string

  @prop()
  lastName: string

  @prop()
  address?: string

  @prop()
  addressLine2?: string

  @prop()
  postalCode?: string

  @prop()
  city?: string

  @prop()
  country?: string
}

class Creator {
  @prop({ lowercase: true, trim: true })
  email: string

  @prop()
  phone: string

  @prop()
  picture: string

  @prop()
  name: string // display name

  @prop({ enum: Gender })
  gender: Gender

  @prop()
  country: string

  @prop()
  language: string

  @prop()
  birthYear: number // 2002

  @prop()
  passwordHash: string

  @prop({ ref: Youtuber })
  youtube: Ref<Youtuber>

  @prop()
  instagramUsername: string

  @prop()
  instagramToken: string

  @prop()
  instagramIsVerified: boolean

  @prop({ _id: false })
  postalAddress?: PostalAddress

  @prop()
  googleAccessToken: string

  @prop()
  googleRefreshToken: string

  @prop({ ref: 'Creator' })
  ambassador?: Ref<Creator> // _id

  @prop()
  resetPasswordToken?: string

  @prop()
  resetPasswordExpires?: number

  @prop({ enum: CreatorStatus, default: CreatorStatus.unverified })
  status: CreatorStatus
}

const CreatorModel = getModelForClass(Creator)

export { Gender, Creator, CreatorModel, PostalAddress, CreatorStatus }
