import * as mongoose from 'mongoose'
import { prop, Ref, getModelForClass, arrayProp } from '@hasezoey/typegoose'
import { CreatorModel, Creator } from '../creator/model'

enum ReviewFormat {
  instagramStory = 'Instagram story',
  instagramPost = 'Instagram post',
  youtubeVideo = 'Youtube video',
}

class Review {
  @prop({ enum: ReviewFormat })
  format: ReviewFormat

  @arrayProp({ items: String })
  medias: string[]

  @prop()
  link: string

  @prop()
  likes?: number

  @prop()
  comments?: number

  @prop()
  views?: number

  @prop({ ref: Creator })
  creator: Ref<Creator>

  @prop()
  postDate: number

  @prop()
  lastUpdateDate: number

  @prop({ default: Date.now })
  submitDate: number
}

const ReviewModel = getModelForClass(Review)

export { Review, ReviewModel, ReviewFormat }
