import * as mongoose from 'mongoose'
import { DocumentType } from '@hasezoey/typegoose'
import { InfluencerModel, Influencer } from '../influencer/model'
import { BrandModel, Brand } from '../brand/model'
import { throttle } from '../../utils/time'
import { CampaignModel } from '../campaign/model'
import { UserModel } from '../user/model'

interface IInfluencerWithMentionedBrands extends Influencer {
  mentioned_brands?: Brand[]
}

async function extractInfluencerBrands(
  influencer: IInfluencerWithMentionedBrands
): Promise<mongoose.Types.ObjectId[]> {
  // Loop over all the brands each influencer mentioned
  const extractBrandsPromises: Promise<DocumentType<Brand>>[] = influencer.mentioned_brands.map(
    async (_brand: Brand) => {
      // Check if brand already exists in database
      const matchingBrand = await BrandModel.findOne({ username: _brand.username })
      // If the brand does not exist, create it
      if (matchingBrand == null) {
        return BrandModel.create(_brand)
      }
      // Or return the existing brand
      return matchingBrand
    }
  )
  // Wait for all the brands to be extracted
  const brands = await Promise.all(extractBrandsPromises)

  // Tiny throttle to avoid crashing
  await throttle(5)

  // Only prepend existing brands if they exist
  const newMentionedBrandsIds =
    influencer.mentionedBrands == null
      ? brands.map(_brand => _brand._id)
      : [...influencer.mentionedBrands, ...brands.map(_brand => _brand._id)]
  // Return brands IDs
  return newMentionedBrandsIds
}

// Move all brands out of the influencer object
async function extractBrands(): Promise<number> {
  // Find all influencers who have mentioned brands
  const count = await InfluencerModel.find({
    'mentioned_brands.0': { $exists: true },
  }).countDocuments()
  console.log(`Parsing ${count} influencers`)
  const influencers = await InfluencerModel.find({ 'mentioned_brands.0': { $exists: true } }).limit(
    4
  )

  // Loop over each of them
  const scanInfluencersPromises = influencers
    .filter(_influencer => 'mentioned_brands' in _influencer)
    .map(async _influencer => {
      const mentionnedBrandIds = await extractInfluencerBrands(
        _influencer as IInfluencerWithMentionedBrands
      )
      await InfluencerModel.findByIdAndUpdate(
        _influencer._id,
        {
          $set: {
            mentionedBrands: mentionnedBrandIds,
          },
        },
        { new: true }
      )
    })
  // Wait for all influencers to be scanned
  await Promise.all(scanInfluencersPromises)

  // Return amount of influencers scanned
  return scanInfluencersPromises.length
}

export { extractBrands, extractInfluencerBrands, IInfluencerWithMentionedBrands }
