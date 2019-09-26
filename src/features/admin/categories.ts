import { Influencer, InfluencerModel } from '../influencer/model'
import { wordIsInText } from '../../utils/strings'

// eslint-disable-next-line global-require
const categoriesData = require('../../static/categories.json') as ICategoryData[]

const newCategories = categoriesData.map(category => category.category.toLowerCase())

const MAX_CATEGORIES = 2

interface ICategoryData {
  category: string
  keywords: string[]
}

interface ICategoryMatch {
  category: string
  instances: number
}

function pickBestCategories(matches: ICategoryMatch[]): string[] {
  // console.log(matches)
  const actualMatches = matches.filter(match => match.instances > 0)
  const sortedMatches = actualMatches.sort((a, b) => b.instances - a.instances)
  const bestMatches = sortedMatches.slice(0, MAX_CATEGORIES)

  // Prevent over-representing the 2nd category
  if (bestMatches.length > 1 && bestMatches[0].instances > bestMatches[1].instances * 10) {
    // Only send first item since it's clearly the dominant one
    return [bestMatches[0].category]
  }
  // Prevent over-representing the 3rd category
  if (bestMatches.length > 2 && bestMatches[0].instances > bestMatches[2].instances * 15) {
    // Only send first 2 items since it's clearly the dominant ones
    return [bestMatches[0].category, bestMatches[1].category]
  }
  // Flatten and return
  return bestMatches.map(match => match.category)
}

function updateReviewedCategories(influencer: Influencer): string[] {
  // Remove categories that don't exist anymore
  const remainingCategories = influencer.category.filter(category =>
    newCategories.includes(category.toLowerCase())
  )
  // If there are no categories left, apply automatic categories
  if (remainingCategories && remainingCategories.length === 0) {
    return getNewCategories(influencer)
  }
  // Or return remaining cateogories, making sure there aren't too many
  const limitedCategories = remainingCategories.filter((_, index) => index < MAX_CATEGORIES)
  return limitedCategories
}

function getNewCategories(influencer: Influencer): string[] {
  const { top_20_hashtags, bio } = influencer
  const hashtags = top_20_hashtags == null ? [] : Object.entries(top_20_hashtags)

  // Reducer function to get occurences count from keywords list
  const countKeywordInstances = (totalCount: number, keyword: string): number => {
    let newCount: number = totalCount
    // Find instances from hashtags (if there are hashtags)
    if (top_20_hashtags != null) {
      const sameHashtag = hashtags.find(
        hashtag => hashtag[0].toLowerCase() === keyword.toLowerCase()
      )
      if (sameHashtag != null) {
        newCount += sameHashtag[1]
        // console.log('From hashtags :', sameHashtag[0], sameHashtag[1])
      }
    }

    // Find instance from bio
    if (bio && wordIsInText(bio, keyword)) {
      // Count more instances because bio keywords are more impactful than hashtags
      // console.log('From bio :', keyword)
      newCount += 2
    }
    return newCount
  }

  const matches: ICategoryMatch[] = categoriesData.map(categoryData => ({
    category: categoryData.category,
    instances: categoryData.keywords.reduce(countKeywordInstances, 0),
  }))

  // Return best categories based on instances
  return pickBestCategories(matches)
}

async function updateInfluencerCategories(
  influencer: Influencer,
  percentage: number = null
): Promise<Influencer> {
  let newInfluencer = { ...influencer }
  // Only update categories if influencer exists
  if (influencer != null) {
    const updatedCategories: string[] = getNewCategories(influencer)
    // Save updated influencer in database
    newInfluencer = await InfluencerModel.findOneAndUpdate(
      { username: influencer.username },
      {
        $set: {
          category: updatedCategories,
        },
      },
      { new: true }
    )
  }

  // Log progress
  if (percentage != null) {
    console.log(`Update ${percentage}% done`)
  }

  return newInfluencer
}

async function updateAllInfluencerCategories(): Promise<string> {
  // Get all influencers
  const allInfluencers: Influencer[] = await InfluencerModel.find().lean()
  const influencers = allInfluencers.filter(
    influencer => influencer != null && influencer.username != null
  )
  const totalCount = influencers.length

  // Loop over each influencer
  const updatePromises = influencers.map(async (influencer, index) => {
    // Prepare percentage to log
    const percentage = Math.round((((index - 1) * 100) / totalCount) * 100) / 100
    // Update individual influencers
    await updateInfluencerCategories(influencer, percentage)
  })

  // Wait for all promises to resolve
  await Promise.all(updatePromises)
  console.log('Big update over')
  return `Updated ${totalCount} items`
}

export { updateInfluencerCategories, updateAllInfluencerCategories }
