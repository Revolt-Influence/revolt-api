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

@ObjectType({ description: 'A review on a social media' })
@modelOptions({
  schemaOptions: { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
})
export class Review {
  @Field(() => ID, { description: 'Mongoose generated ID' })
  readonly _id: mongoose.Types.ObjectId

  @Field(() => ReviewFormat, { description: 'Platform of the review' })
  @prop({ enum: ReviewFormat })
  format: ReviewFormat

  @Field({
    description:
      'ID specific to the platform the review is hosted on (not Mongoose related).  e.g.: youtube video ID',
  })
  @prop()
  platformId: string

  @Field({ description: 'Link to view the review' })
  @prop()
  link: string

  @Field({ description: 'Image to preview the review. Not Cloudinary' })
  thumbnail: string

  @Field(() => Creator, { description: 'Creator who made the review' })
  @prop({ ref: Creator })
  creator: Ref<Creator>

  @Field(() => [ReviewStats], { description: 'History of the reviews stats since they were added' })
  @arrayProp({
    itemsRef: 'ReviewStats',
    ref: 'ReviewStats',
    localField: '_id',
    foreignField: 'review',
    justOne: false,
    options: { sort: { createdAt: -1 }, limit: 50 },
  })
  stats: Ref<ReviewStats>[]

  @Field(() => Date)
  createdAt: Readonly<Date>

  @Field(() => Date)
  updatedAt: Readonly<Date>
}

export const ReviewModel = getModelForClass(Review)

@ObjectType({ description: 'Review stats at a point in time' })
@modelOptions({ schemaOptions: { timestamps: true } })
export class ReviewStats {
  @Field(() => ID, { description: 'Mongoose generated ID' })
  readonly _id: mongoose.Types.ObjectId

  @Field(() => Review, { description: 'What review these stats are for' })
  @prop({ ref: 'Review' })
  review: Ref<Review>

  @Field()
  @prop()
  likeCount: number

  @Field()
  @prop()
  commentCount: number

  @Field()
  @prop()
  viewCount: number

  @Field({ description: 'How many times the collab-specific link was clicked' })
  @prop({ default: 0 })
  linkClicksCount: number

  @Field(() => Date)
  createdAt: Readonly<Date>

  @Field(() => Date)
  updatedAt: Readonly<Date>
}

export const ReviewStatsModel = getModelForClass(ReviewStats)
