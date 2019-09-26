import * as mongoose from 'mongoose'
import { prop, getModelForClass, arrayProp } from '@hasezoey/typegoose'
import { loadType } from 'mongoose-float'
import { AudienceMetric, percentageOptions } from '../influencer/model'

const Float = loadType(mongoose)

class YoutubeVideo {
  @prop()
  title: string

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
  publishedDate: number
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

class YoutubeAudience {
  @arrayProp({ _id: false, items: AudienceMetric })
  topAges: AudienceMetric[]

  @arrayProp({ _id: false, items: AudienceMetric })
  topCountries: AudienceMetric[]

  @prop(percentageOptions)
  malePercentage: number

  @prop(percentageOptions)
  femalePercentage: number
}

class Youtuber {
  @prop()
  name: string // channel title

  @prop()
  subscriberCount: number

  @prop()
  viewCount: number

  @prop()
  videoCount: number

  @prop()
  channelId: string

  @prop()
  picture: string

  @prop()
  country: string

  @prop()
  language: string

  @prop()
  url: string

  @prop({ _id: false })
  audience: YoutubeAudience

  @arrayProp({ _id: false, items: YoutubeVideo })
  videos: YoutubeVideo[]

  @prop()
  uploadsPlaylistId: string

  @prop()
  lastScrapingDate: number // timestamp

  @prop({ default: Date.now })
  creationDate: number // timestamp
}

const YoutuberModel = getModelForClass(Youtuber)

export { IChannelReport, RawYoutubeMetric, Youtuber, YoutuberModel, YoutubeAudience, YoutubeVideo }
