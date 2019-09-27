import * as mongoose from 'mongoose'
import { prop, getModelForClass, arrayProp, modelOptions } from '@hasezoey/typegoose'
import { loadType } from 'mongoose-float'
import { Field, ObjectType } from 'type-graphql'

const Float = loadType(mongoose, 4)

const percentageOptions = { type: Float, max: 100, min: 0, required: true }

class AudienceMetric {
  @Field()
  @prop()
  name: string

  @Field({ description: 'Between 0 and 100' })
  @prop(percentageOptions)
  percentage: number
}

class YoutubeVideo {
  @Field()
  @prop()
  title: string

  @Field({ description: 'URL to Youtube CDN, not Cloudinary' })
  @prop()
  thumbnail: string

  @prop()
  videoId: string

  @prop()
  url: string

  @prop()
  viewCount: number

  @prop()
  commentCount: number

  @prop()
  likeCount: number

  @prop()
  publishedAt: Date
}

type RawYoutubeMetric = [string, number][]

// Data returned from the various Youtube APIs. Not stored in mongo directly.
interface IChannelReport {
  // Channel data
  name: string
  viewCount: number
  subscriberCount: number
  videoCount: number
  channelId: string
  thumbnail: string
  country: string
  language: string
  url: string
  uploadsPlaylistId: string
  // Audience metrics
  audienceAge: RawYoutubeMetric
  audienceGender: RawYoutubeMetric
  audienceCountry: RawYoutubeMetric
}

@ObjectType()
class YoutubeAudience {
  @Field(() => [AudienceMetric])
  @arrayProp({ _id: false, items: AudienceMetric })
  ageGroups: AudienceMetric[]

  @arrayProp({ _id: false, items: AudienceMetric })
  countries: AudienceMetric[]

  @prop(percentageOptions)
  malePercentage: number

  @prop(percentageOptions)
  femalePercentage: number
}

@ObjectType()
@modelOptions({ schemaOptions: { timestamps: true } })
class Youtuber {
  @Field({ description: 'Channel title' })
  @prop()
  name: string // channel title

  @Field()
  @prop()
  subscriberCount: number

  @Field()
  @prop()
  viewCount: number

  @Field()
  @prop()
  videoCount: number

  @Field()
  @prop()
  channelId: string

  @Field({ description: 'URL of image on Youtube CDN, not Cloudinary' })
  @prop()
  picture: string

  @Field({ description: 'Link of Youtube channel' })
  @prop()
  url: string

  @Field(() => YoutubeAudience)
  @prop({ _id: false })
  audience: YoutubeAudience

  @Field(() => [YoutubeVideo])
  @arrayProp({ _id: false, items: YoutubeVideo })
  videos: YoutubeVideo[]

  @Field()
  @prop()
  uploadsPlaylistId: string

  @Field()
  createdAt: Readonly<Date>

  @Field()
  updatedAt: Readonly<Date>
}

const YoutuberModel = getModelForClass(Youtuber)

export { IChannelReport, RawYoutubeMetric, Youtuber, YoutuberModel, YoutubeAudience, YoutubeVideo }
