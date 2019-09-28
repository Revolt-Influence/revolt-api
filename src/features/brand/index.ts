import { mongoose } from '@hasezoey/typegoose'
import { Brand, BrandModel } from './model'
import { UpdateBrandInput } from './resolver'
import { errorNames } from '../../utils/errors'

async function updateBrand(
  brandId: mongoose.Types.ObjectId,
  updatedBrand: UpdateBrandInput
): Promise<Brand> {
  // Find brand in database
  const brand = await BrandModel.findById(brandId)
  if (!brand) {
    throw new Error(errorNames.brandNotFound)
  }
  // Update brand settings
  brand.name = updatedBrand.name
  brand.logo = updatedBrand.logo
  brand.website = updatedBrand.website
  await brand.save()
  return brand
}

export { updateBrand }
