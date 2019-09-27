import * as mongoose from 'mongoose'
import { prop, Ref, getModelForClass, arrayProp, modelOptions } from '@hasezoey/typegoose'
import { registerEnumType, Field, ObjectType } from 'type-graphql'
import { CreatorModel, Creator } from '../creator/model'

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
  @Field(() => ReviewFormat, { description: 'Platform of the review' })
  @prop({ enum: ReviewFormat })
  format: ReviewFormat

  @Field({ description: 'Link to view the review' })
  @prop()
  link: string

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

  @Field()
  createdAt: Readonly<Date>

  @Field()
  updatedAt: Readonly<Date>
}

const ReviewModel = getModelForClass(Review)

export { Review, ReviewModel, ReviewFormat }
