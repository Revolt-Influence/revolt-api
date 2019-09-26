import { InfluencerModel } from '../influencer/model'

function castToFloat(error: any): number {
  // Check if it's already a float
  if (typeof error === 'number') {
    return error
  }
  const regex = /"\$numberDouble":"((\\"|[^"])*)"/im
  const flatError = JSON.stringify(error)
  const matches = flatError.match(regex)
  if (matches == null) {
    return null
  }
  const percentage = parseFloat(matches[1])
  if (percentage < 0) {
    return 0
  }
  if (percentage > 100) {
    return 100
  }
  return percentage
}

async function formatDoubles(): Promise<number> {
  // Get all influencers
  const influencers = await InfluencerModel.find()

  // Remove all $numberDoubles from each influencer
  const formatPromises = influencers.map(async _influencer => {
    _influencer.engagement_rate = castToFloat(_influencer.engagement_rate)
    if (_influencer.sponsored_engagement_rate != null) {
      _influencer.sponsored_engagement_rate = castToFloat(_influencer.sponsored_engagement_rate)
    }
    if (_influencer.audience != null) {
      _influencer.audience.authenticPercentage = castToFloat(
        _influencer.audience.authenticPercentage
      )
      _influencer.audience.influencersPercentage = castToFloat(
        _influencer.audience.influencersPercentage
      )
      _influencer.audience.massfollowersPercentage = castToFloat(
        _influencer.audience.massfollowersPercentage
      )
      _influencer.audience.suspiciousPercentage = castToFloat(
        _influencer.audience.suspiciousPercentage
      )
      _influencer.audience.malePercentage = castToFloat(_influencer.audience.malePercentage)
      _influencer.audience.femalePercentage = castToFloat(_influencer.audience.femalePercentage)
      _influencer.audience.topCities = _influencer.toObject().audience.topCities.map(_city => ({
        ..._city,
        percentage: castToFloat(_city.percentage),
      }))
      _influencer.audience.topCountries = _influencer
        .toObject()
        .audience.topCountries.map(_country => ({
          ..._country,
          percentage: castToFloat(_country.percentage),
        }))
      _influencer.audience.topLanguages = _influencer
        .toObject()
        .audience.topLanguages.map(_language => ({
          ..._language,
          percentage: castToFloat(_language.percentage),
        }))
      _influencer.audience.topInterests = _influencer
        .toObject()
        .audience.topInterests.map(_interest => ({
          ..._interest,
          percentage: castToFloat(_interest.percentage),
        }))
    }
    // Save changes in Mongo
    await _influencer.save()
  })
  // Run promises in parallel
  await Promise.all(formatPromises)
  return influencers.length
}

export { formatDoubles }
