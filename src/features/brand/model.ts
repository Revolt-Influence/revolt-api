import mongoose from 'mongoose'
import { prop, Ref, getModelForClass, arrayProp, modelOptions } from '@hasezoey/typegoose'
import { Field, ID, ObjectType } from 'type-graphql'
import { User } from '../user/model'

@ObjectType({ description: 'A brand may be a game publisher, has User members' })
@modelOptions({ schemaOptions: { timestamps: true } })
class Brand {
  @Field(type => ID, { description: 'Mongoose generated ID' })
  readonly _id: mongoose.Types.ObjectId

  @Field()
  @prop()
  name: string

  @Field({ description: 'Cloudinary URL of brand logo' })
  @prop()
  logo: string

  @Field({ description: "URL of the brand's website" })
  @prop()
  website: string

  @Field(() => [User], { description: 'All the users that work for the brand' })
  @arrayProp({ itemsRef: 'User' })
  users: Ref<User>[]

  @Field(() => Date)
  createdAt: Readonly<Date>

  @Field(() => Date)
  updatedAt: Readonly<Date>
}

const BrandModel = getModelForClass(Brand)

export { Brand, BrandModel }
