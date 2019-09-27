import { YoutubeAudience, IChannelReport } from './model'

function getAudienceFromReport(report: IChannelReport): YoutubeAudience {
  const rawMale = report.audienceGender.find(_gender => _gender[0] === 'male')
  const rawFemale = report.audienceGender.find(_gender => _gender[0] === 'female')
  // Make sure percentages are between 0 and 100, not biased by private/unshown videos
  const totalCountryViews = report.audienceCountry.reduce((sum, _country) => sum + _country[1], 0)
  // Normally report.views should be higher but sometimes it's not
  const totalViews = totalCountryViews > report.viewCount ? totalCountryViews : report.viewCount
  // Format all data into ready-to-save object
  const audience: YoutubeAudience = {
    ageGroups: report.audienceAge.map(_age => ({ name: _age[0], percentage: _age[1] })),
    countries: report.audienceCountry.map(_country => ({
      name: _country[0],
      percentage: (_country[1] * 100) / totalViews,
    })),
    malePercentage: rawMale == null ? 0 : rawMale[1],
    femalePercentage: rawFemale == null ? 0 : rawFemale[1],
  }
  return audience
}

export { getAudienceFromReport }
