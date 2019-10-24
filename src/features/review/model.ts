import { getModelForClass, modelOptions, prop, Ref, arrayProp } from '@typegoose/typegoose'
import mongoose from 'mongoose'
import { Field, ID, ObjectType, registerEnumType } from 'type-graphql'
import { Creator } from '../creator/model'

export enum ReviewFormat {
  YOUTUBE_VIDEO = 'Youtube video',
}
registerEnumType(ReviewFormat, {
  name: 'ReviewFormat',
  description: 'What platform the creator will use to promote the game',
})

@ObjectType({ description: 'Review stats at a point in time' })
@modelOptions({ schemaOptions: { timestamps: true } })
export class ReviewStats {
  @Field(() => ID, { description: 'Mongoose generated ID' })
  readonly _id: mongoose.Types.ObjectId

  @Field()
  @prop()
  likeCount?: number

  @Field()
  @prop()
  commentCount: number

  @Field()
  @prop()
  viewCount: number

  @Field(() => Date)
  createdAt: Readonly<Date>

  @Field(() => Date)
  updatedAt: Readonly<Date>
}

export const ReviewStatsModel = getModelForClass(ReviewStats)

@ObjectType({ description: 'A review on a social media' })
@modelOptions({ schemaOptions: { timestamps: true } })
export class Review {
  @Field(() => ID, { description: 'Mongoose generated ID' })
  readonly _id: mongoose.Types.ObjectId

  @Field(() => ReviewFormat, { description: 'Platform of the review' })
  @prop({ enum: ReviewFormat })
  format: ReviewFormat

  @Field({ description: 'Link to view the review' })
  @prop()
  link: string

  @Field({ description: 'Image to preview the review. Not Cloudinary' })
  thumbnail: string

  @Field()
  @prop()
  likeCount?: number

  @Field()
  @prop()
  commentCount: number

  @Field()
  @prop()
  viewCount: number

  @Field(() => Creator, { description: 'Creator who made the review' })
  @prop({ ref: Creator })
  creator: Ref<Creator>

  @Field(() => [ReviewStats], { description: 'History of the reviews stats since they were added' })
  @arrayProp({ itemsRef: 'ReviewStats', default: [] })
  stats: ReviewStats[]

  @Field(() => Date)
  createdAt: Readonly<Date>

  @Field(() => Date)
  updatedAt: Readonly<Date>
}

export const ReviewModel = getModelForClass(Review)
