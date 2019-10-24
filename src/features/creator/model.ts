import { getModelForClass, prop, Ref, modelOptions, arrayProp } from '@hasezoey/typegoose'
import mongoose from 'mongoose'
import { Field, ID, ObjectType, registerEnumType } from 'type-graphql'
import { Youtuber } from '../youtuber/model'

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
  ANY = 'any',
}
registerEnumType(AgeGroup, {
  name: 'AgeGroup',
  description: 'Age groups based formatted to match YouTube API data',
})

export enum Language {
  ENGLISH = 'english',
  SPANISH = 'spanish',
  GERMAN = 'german',
  FRENCH = 'french',
  JAPANESE = 'japanese',
  MANDARIN = 'mandarin chinese',
  RUSSIAN = 'russian',
  PORTUGUESE = 'portuguese',
  ITALIAN = 'italian',
  ARABIC = 'arabic',
  SWEDISH = 'swedish',
  NORWEGIAN = 'norwegian',
  HINDI = 'hindi',
  INDONESIAN = 'indonesian',
  OTHER = 'other',
}
registerEnumType(Language, {
  name: 'Language',
  description: 'Spoken language or dialect',
})

export enum GameCategory {
  RPG = 'RPG',
  STRATEGY = 'Strategy',
  ACTION = 'Action',
  ADVENTURE = 'Adventure',
  SIMULATION = 'Simulation',
  HORROR = 'Horror',
  SPORTS = 'Sports',
  MMO = 'MMO',
  PARTY_GAME = 'Party game',
  INDIE = 'Indie',
  PLATFORMER = 'Platformer',
  RETRO = 'Retro',
  SHOOTER = 'Shooter',
  AR_VR = 'AR/VR',
  SURVIVAL = 'Survival',
  ARCADE = 'Arcade',
  ROGUELIKE = 'Roguelike',
  PUZZLE = 'Puzzle',
}
registerEnumType(GameCategory, {
  name: 'GameCategory',
  description: 'Family of games',
})

@ObjectType({ description: 'Someone who creates content and has a community' })
@modelOptions({ schemaOptions: { timestamps: true } })
class Creator {
  @Field(() => ID, { description: 'Mongoose generated ID' })
  readonly _id: mongoose.Types.ObjectId

  @Field({ description: 'The email is used for login and notifications' })
  @prop({ lowercase: true, trim: true, unique: true })
  email: string

  @Field({
    description: 'Cloudinary URL of a picture got from user upload or a social network',
    nullable: true,
  })
  @prop()
  picture?: string

  @Field({ description: 'Creator display name, can be a full name or a pseudo', nullable: true })
  @prop()
  name?: string

  @Field({ description: 'Year of birth, used to get age approximation and ensure he is 13+' })
  @prop()
  birthYear: number

  @Field(() => [GameCategory], { description: 'Game categories the creator plays' })
  @arrayProp({ enum: GameCategory, type: String, items: String })
  categories: GameCategory[]

  @Field(() => Language, { description: "What language creator's content is in" })
  @prop({ enum: Language, type: String, default: Language.ENGLISH })
  language: string

  @prop()
  password: string

  @Field(() => Youtuber, { description: 'Youtube account linked to the creator', nullable: true })
  @prop({ ref: Youtuber })
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

  @prop()
  stripeConnectedAccountId?: string

  @Field({ nullable: true, description: 'Temporary link used to access the Stripe dashboard' })
  stripeLoginLink?: string

  @Field({ description: 'Whether the creator has a Stripe connect account' })
  hasConnectedStripe: boolean

  @Field(() => CreatorStatus, { description: 'Whether the influencer was validated by an admin' })
  @prop({ enum: CreatorStatus, type: String, default: CreatorStatus.UNVERIFIED })
  status: CreatorStatus

  @Field(() => [String], { description: 'Email of brands that the influencer referred' })
  @arrayProp({ type: String, items: String, default: [] })
  referredBrandEmails: string[]

  @Field(() => Date)
  createdAt: Readonly<Date>

  @Field(() => Date)
  updatedAt: Readonly<Date>
}

const CreatorModel = getModelForClass(Creator)

export { Gender, Creator, CreatorModel, CreatorStatus, AgeGroup }
