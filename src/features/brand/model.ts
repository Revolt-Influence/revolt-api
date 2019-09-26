import * as mongoose from 'mongoose'
import { prop, Ref, getModelForClass, arrayProp } from '@hasezoey/typegoose'
import { User } from '../user/model'

class Brand {
  @prop()
  username: string // @chanelofficial

  @prop()
  name: string // CHANEL

  @prop()
  category: string

  @prop()
  subCategory: string

  @prop()
  logo: string

  @prop()
  isSignedUp: boolean

  @prop()
  link: string

  @arrayProp({ itemsRef: 'User' })
  users: Ref<User>[]
}

const BrandModel = getModelForClass(Brand)

export { Brand, BrandModel }
