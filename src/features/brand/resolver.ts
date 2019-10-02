import {
  Query,
  Arg,
  Resolver,
  Mutation,
  Authorized,
  InputType,
  Field,
  Root,
  FieldResolver,
} from 'type-graphql'
import { mongoose, DocumentType } from '@hasezoey/typegoose'
import { Brand, BrandModel } from './model'
import { AuthRole } from '../../middleware/auth'
import { updateBrand } from '.'
import { User, UserModel } from '../user/model'

@InputType()
class UpdateBrandInput implements Partial<Brand> {
  @Field()
  logo: string

  @Field()
  name: string

  @Field()
  website: string
}

@Resolver(() => Brand)
class BrandResolver {
  @Query(() => Brand, { description: 'Get brand by ID' })
  async brand(@Arg('id') id: string): Promise<Brand> {
    const brand = await BrandModel.findById(id)
    return brand
  }

  @Query(() => [Brand], { description: 'Get all brands' })
  async brands(): Promise<Brand[]> {
    const brands = await BrandModel.find()
    return brands
  }

  @Authorized(AuthRole.USER)
  @Mutation(() => Brand, { description: 'Update brand attributes' })
  async updateBrand(
    @Arg('id') id: string,
    @Arg('updatedBrand') updatedBrand: UpdateBrandInput
  ): Promise<Brand> {
    const savedBrand = await updateBrand(mongoose.Types.ObjectId(id), updatedBrand)
    return savedBrand
  }

  @FieldResolver()
  async users(@Root() brand: DocumentType<Brand>): Promise<User[]> {
    const users = await UserModel.find()
      .where('_id')
      .in(brand.users)
    return users
  }
}

export { BrandResolver, UpdateBrandInput }
