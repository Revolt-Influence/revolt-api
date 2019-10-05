import { getModelForClass, modelOptions, prop, Ref } from '@hasezoey/typegoose'
import mongoose from 'mongoose'
import { Field, ID, ObjectType, registerEnumType } from 'type-graphql'
import { Creator } from '../creator/model'

enum ReviewFormat {
  YOUTUBE_VIDEO = 'Youtube video',
}
registerEnumType(ReviewFormat, {
  name: 'ReviewFormat',
  description: 'What platform the creator will use to promote the game',
})

@ObjectType({ description: 'A review on a social media' })
@modelOptions({ schemaOptions: { timestamps: true } })
class Review {
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

  @Field(() => Date)
  createdAt: Readonly<Date>

  @Field(() => Date)
  updatedAt: Readonly<Date>
}

const ReviewModel = getModelForClass(Review)

export { Review, ReviewModel, ReviewFormat }
