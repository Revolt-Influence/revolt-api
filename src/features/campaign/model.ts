import { arrayProp, getModelForClass, modelOptions, prop, Ref } from '@hasezoey/typegoose'
import mongoose from 'mongoose'
import { loadType } from 'mongoose-float'
import { Authorized, Field, ID, InputType, ObjectType, registerEnumType } from 'type-graphql'
import { AuthRole } from '../../middleware/auth'
import { Brand } from '../brand/model'
import { Collab } from '../collab/model'
import { AgeGroup, Gender, GameCategory } from '../creator/model'
import { Review } from '../review/model'
import { User } from '../user/model'

const Float = loadType(mongoose, 4)

export enum TrackingProvider {
  NONE = 'No tracking provider',
  GOOGLE_ANALYTICS = 'Google Analytics',
  GAME_ANALYTICS = 'Game Analytics',
  UNITY_ANALYTICS = 'Unity Analytics',
  ADJUST = 'Adjust',
  APPSFLYER = 'AppsFlyer',
  BUFFPANEL = 'BuffPanel',
  KOCHAVA = 'Kochava',
  CUSTOM_LINK = 'Custom tracking link',
  TENJIN = 'Tenjin',
  TUNE = 'Tune',
  SINGULAR = 'Singular',
  OTHER = 'Other tracking provider',
}
registerEnumType(TrackingProvider, {
  name: 'TrackingProvider',
  description: 'Platforms that provide analytics for game',
})

@ObjectType({ description: 'What a creator can receive' })
@InputType('CampaignProductInput')
class CampaignProduct {
  @Field({ description: 'Name of the product' })
  @prop()
  name: string

  @Field({ description: 'Marketing description of the game' })
  @prop()
  pitch: string

  @Field({ description: 'Link to more info about the product' })
  @prop()
  website: string

  @Field(() => [String], { description: 'Cloudinary URLs of promo images of the product' })
  @arrayProp({ items: String, type: String })
  pictures: string[]

  @Field(() => Date, { description: 'Game lauch date, can be past or future' })
  @prop({ type: Date })
  launchedAt: Date

  @Field(() => [GameCategory], { description: 'Game categories that best describe the game' })
  @arrayProp({ enum: GameCategory, type: String, items: String })
  categories: GameCategory[]

  @Field({ nullable: true, description: 'Link of a YouTube video that presents the product' })
  @prop()
  youtubeLink?: string
}

export const defaultCampaignProduct: CampaignProduct = {
  name: 'My new game',
  pitch: '',
  website: '',
  pictures: [],
  launchedAt: new Date(),
  categories: [],
}

@ObjectType({ description: 'A model of the audience a brand wants to reach' })
@InputType('CampaignAudienceInput')
class TargetAudience {
  @Field(() => Gender, { description: 'Men, women or both' })
  @prop({ enum: Gender, type: String, default: Gender.ANY })
  gender: Gender

  @Field(() => [String], { description: 'ISO 3166-1-alpha-2 codes of countries' })
  @arrayProp({ items: String, type: String, default: [] })
  countries: string[]

  @Field(() => [AgeGroup], { description: 'Groups of age' })
  @arrayProp({ enum: AgeGroup, items: String, type: String, default: [AgeGroup.ANY] })
  ageGroups: AgeGroup[]
}

export const defaultTargetAudience: TargetAudience = {
  gender: Gender.ANY,
  countries: [],
  ageGroups: [AgeGroup.ANY],
}

@ObjectType({ description: 'A campaign is made by brands to find collabs to promote a product' })
@modelOptions({
  schemaOptions: { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
})
class Campaign {
  @Field(() => ID, { description: 'Mongoose generated ID' })
  readonly _id: mongoose.Types.ObjectId

  @Field({ description: 'More info about the campaign and its goals' })
  @prop({ default: '' })
  goal: string

  @Field(() => User, { description: 'The user who created the campaign' })
  @prop({ ref: 'User' })
  owner: Ref<User>

  @Field(() => Brand, { nullable: true, description: 'The brand that published the campaign' })
  @prop({ ref: 'Brand' })
  brand: Ref<Brand>

  @Field({ description: 'What the creator will receive' })
  @prop({ _id: false, type: CampaignProduct, default: defaultCampaignProduct })
  product: CampaignProduct

  @Field(() => TargetAudience, { description: 'The ideal audience the brand wants to reach' })
  @prop({ _id: false, type: TargetAudience, default: defaultTargetAudience })
  targetAudience: TargetAudience

  @Field(() => [String], { description: 'Rules that creators must respect to receive the gift' })
  @arrayProp({ items: String, default: ['Feature the game on a Twitch or YouTube video'] })
  rules: string[]

  @Field({ description: 'Total amount of money that will be given to creators', nullable: true })
  @prop(() => Float)
  estimatedBudget: number

  @Field(() => TrackingProvider, { description: 'Solution used to provide game analytics' })
  @prop({ enum: TrackingProvider, type: String, default: TrackingProvider.NONE })
  trackingProvider: TrackingProvider

  @Field({ description: 'Whether the brand is willing to publish the campaign' })
  @prop({ default: true })
  isArchived: boolean // whether the brand removed it

  @Field({ description: 'Whether an admin allowed the campaign to be published' })
  @prop({ default: false })
  isReviewed: boolean

  @Authorized(AuthRole.USER)
  @Field(() => [Collab], { description: 'All collabs linked to the campaign' })
  @arrayProp({
    itemsRef: 'Collab',
    ref: 'Collab',
    localField: '_id',
    foreignField: 'campaign',
    justOne: false,
  })
  collabs: Ref<Collab>[]

  @Authorized(AuthRole.USER)
  @Field(() => [Review], { description: 'All reviews made for the campaign' })
  @arrayProp({
    itemsRef: 'Review',
    ref: 'Review',
    localField: '_id',
    foreignField: 'campaign',
    justOne: false,
  })
  reviews: Ref<Review>[]

  @Field(() => Date)
  createdAt: Readonly<Date>

  @Field(() => Date)
  updatedAt: Readonly<Date>
}

const CampaignModel = getModelForClass(Campaign)

// Defaults
const mandatoryRules: string[] = ['Identifier @revolt.club sur les publications Instagram']
const defaultRules = ['Les posts devront être gardés au moins 90 jours sur la page']

export { Campaign, CampaignModel, CampaignProduct, TargetAudience }
