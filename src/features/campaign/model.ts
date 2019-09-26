import * as mongoose from 'mongoose'
import { prop, Ref, getModelForClass, arrayProp } from '@hasezoey/typegoose'
import { Gender } from '../creator/model'
import { BrandModel, Brand } from '../brand/model'
import { ReviewFormat } from '../review/model'

enum Currency {
  euro = 'Euro',
  dollar = 'US Dollar',
  pound = 'Pound Sterling',
}

class CampaignBrief {
  @prop()
  description: string

  @prop({ default: false })
  wantsHelp: boolean
}

class CampaignGift {
  @prop()
  name: string

  @prop({ default: false })
  valueIsShown?: boolean

  @prop({ default: false })
  addressIsNeeded: boolean

  @prop()
  value?: number

  @prop()
  link?: string

  @prop()
  details?: string

  @prop()
  picture: string

  @prop({ enum: Currency })
  currency?: Currency
}

class CampaignTask {
  @arrayProp({ items: String, enum: ReviewFormat })
  formats: ReviewFormat[]

  @prop()
  including: string

  @prop()
  daysToReview: number

  @arrayProp({ items: String })
  rules: string[]
}

class CampaignTarget {
  @prop({ enum: Gender })
  gender?: Gender

  @prop()
  country?: string

  @prop()
  city?: string
}

class CampaignSettings {
  @prop({ _id: false })
  brief: CampaignBrief

  @prop({ ref: 'Brand' })
  brand: Ref<Brand>

  @prop({ _id: false })
  gift: CampaignGift

  @prop({ _id: false })
  target: CampaignTarget

  @prop({ _id: false })
  task: CampaignTask
}

class Campaign {
  @prop()
  name: string

  @prop()
  owner: string

  @prop({ default: Date.now })
  creationDate: number

  @prop({ _id: false })
  settings: CampaignSettings

  @prop({ default: true })
  isArchived: boolean // whether the brand removed it

  @prop({ default: false })
  isReviewed: boolean // whether an admin has accepted it
}

const CampaignModel = getModelForClass(Campaign)

// Defaults
const mandatoryRules: string[] = ['Identifier @revolt.club sur les publications Instagram']
const defaultRules = ['Les posts devront être gardés au moins 90 jours sur la page']
const defaultTask: CampaignTask = {
  formats: [],
  including: '',
  daysToReview: 15,
  rules: [],
}
const initialCampaignSettings: CampaignSettings = {
  brief: {
    description: '',
    wantsHelp: false,
  },
  brand: null,
  gift: {
    addressIsNeeded: false,
    valueIsShown: false,
    name: '',
    picture: '',
    link: '',
  },
  target: {
    // gender: null,
    country: null,
    city: null,
  },
  task: {
    ...defaultTask,
    rules: [...mandatoryRules, ...defaultRules],
  },
}

export {
  Campaign,
  CampaignModel,
  CampaignBrief,
  CampaignGift,
  CampaignTask,
  CampaignSettings,
  CampaignTarget,
  initialCampaignSettings,
}
