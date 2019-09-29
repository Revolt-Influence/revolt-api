import * as mongoose from 'mongoose'
import { prop, Ref, getModelForClass, arrayProp, modelOptions } from '@hasezoey/typegoose'
import { Field, registerEnumType, ObjectType, ID, InputType } from 'type-graphql'
import { Gender, AgeGroup } from '../creator/model'
import { BrandModel, Brand } from '../brand/model'
import { ReviewFormat } from '../review/model'
import { User } from '../user/model'

@ObjectType({ description: 'What a creator can receive' })
@InputType('CampaignProductInput')
class CampaignProduct {
  @Field({ description: 'Name of the product' })
  @prop({ default: '' })
  name: string

  @Field({ description: 'Paragraph of info about the product' })
  @prop({ default: '' })
  description: string

  @Field({ description: 'Link to more info about the product' })
  @prop({ default: '' })
  website: string

  @Field(() => [String], { description: 'Cloudinary URLs of promo images of the product' })
  @prop({ default: '' })
  pictures: string[]

  @Field({ nullable: true, description: 'Link of a YouTube video that presents the product' })
  @prop()
  youtubeLink: string
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
  @arrayProp({ enum: AgeGroup, items: String, type: String, default: [] })
  ageGroups: AgeGroup[]
}

@ObjectType({ description: 'A campaign is made by brands to find collabs to promote a product' })
@modelOptions({ schemaOptions: { timestamps: true } })
class Campaign {
  @Field(type => ID, { description: 'Mongoose generated ID' })
  readonly _id: mongoose.Types.ObjectId

  @Field({ description: 'The campaign name that is promoted to the creators' })
  @prop({ default: 'My new campaign' })
  name: string

  @Field({ description: 'More info about the campaign and its goals' })
  @prop({ default: '' })
  description: string

  @Field(() => User, { description: 'The user who created the campaign' })
  @prop({ ref: 'User' })
  owner: Ref<User>

  @Field(() => Brand, { nullable: true, description: 'The brand that published the campaign' })
  @prop({ ref: 'Brand' })
  brand: Ref<Brand>

  @Field({ description: 'What the creator will receive' })
  @prop({ _id: false })
  product: CampaignProduct

  @Field(() => TargetAudience, { description: 'The ideal audience the brand wants to reach' })
  @prop({ _id: false })
  targetAudience: TargetAudience

  @Field(() => [String], { description: 'Rules that creators must respect to receive the gift' })
  @arrayProp({ items: String })
  rules: string[]

  @Field({ description: 'Whether the brand is willing to publish the campaign' })
  @prop({ default: true })
  isArchived: boolean // whether the brand removed it

  @Field({ description: 'Whether an admin allowed the campaign to be published' })
  @prop({ default: false })
  isReviewed: boolean

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
