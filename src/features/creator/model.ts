import mongoose from 'mongoose'
import { prop, Ref, getModelForClass } from '@hasezoey/typegoose'
import { registerEnumType, ObjectType, Field, ID } from 'type-graphql'
import { YoutuberModel, Youtuber } from '../youtuber/model'

enum CreatorStatus {
  UNVERIFIED = 'unverified',
  VERIFIED = 'verified',
  BLOCKED = 'blocked',
}
registerEnumType(CreatorStatus, {
  name: 'CreatorStatus',
  description: 'Whether a creator was allowed to access the platform',
})

enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  ANY = 'any',
}
registerEnumType(Gender, {
  name: 'Gender',
  description: "Male female or don't care",
})

enum AgeGroup {
  AGE_13_17 = 'age13-17',
  AGE_18_24 = 'age18-24',
  AGE_25_34 = 'age25-34',
  AGE_35_44 = 'age35-44',
  AGE_45_54 = 'age45-54',
  AGE_55_64 = 'age55-64',
  AGE_65_PLUS = 'age65-',
}
registerEnumType(AgeGroup, {
  name: 'AgeGroup',
  description: 'Age groups based formatted to match YouTube API data',
})

@ObjectType({ description: 'Someone who creates content and has a community' })
class Creator {
  @Field(type => ID, { description: 'Mongoose generated ID' })
  readonly _id: mongoose.Types.ObjectId

  @Field({ description: 'The email is used for login and notifications' })
  @prop({ lowercase: true, trim: true, unique: true })
  email: string

  @Field({ description: 'Used in case of problems, not accessible to brands' })
  @prop()
  phone: string

  @Field({ description: 'Cloudinary URL of a picture got from user upload or a social network' })
  @prop()
  picture: string

  @Field({ description: 'Creator-defined named, can be a full name or a pseudo' })
  @prop()
  name: string // display name

  @Field(() => Gender, { description: 'Male, female or other' })
  @prop({ enum: Gender })
  gender: Gender

  @Field({ description: 'Where the creator comes from' })
  @prop()
  country: string

  @Field({ description: 'Year of birth, used to get age approximation and ensure he is 13+' })
  @prop()
  birthYear: number

  @prop()
  password: string

  @Field(() => Youtuber, { description: 'Youtube account linked to the creator', nullable: true })
  @prop({ ref: Youtuber, sparse: true })
  youtube: Ref<Youtuber>

  @prop()
  googleAccessToken: string

  @prop()
  googleRefreshToken: string

  @Field(() => Creator, {
    description: 'The creator that signed up the influencer',
    nullable: true,
  })
  @prop({ ref: 'Creator' })
  ambassador?: Ref<Creator> // _id

  @prop()
  resetPasswordToken?: string

  @prop()
  resetPasswordExpiresAt?: Date

  @Field(() => CreatorStatus, { description: 'Whether the influencer was validated by an admin' })
  @prop({ enum: CreatorStatus, type: String, default: CreatorStatus.UNVERIFIED })
  status: CreatorStatus
}

const CreatorModel = getModelForClass(Creator)

export { Gender, Creator, CreatorModel, CreatorStatus, AgeGroup }
