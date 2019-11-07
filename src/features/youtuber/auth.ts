import { google } from 'googleapis'
import { DocumentType, mongoose } from '@typegoose/typegoose'
import { CustomError, errorNames } from '../../utils/errors'
import { Creator, CreatorModel } from '../creator/model'
import { uploadToCloudinary } from '../../utils/pictures'
import { IChannelReport, RawYoutubeMetric, Youtuber, YoutuberModel, YoutubeVideo } from './model'
import { getAudienceFromReport } from './audience'

import moment = require('moment')

interface GoogleData {
  googleAccessToken: string
  googleRefreshToken: string
  name: string
  picture: string
  email: string
}

const CLIENT_ID = '1084044949036-9vs7ckrse27t3c1kep4k24l8i9rv906k.apps.googleusercontent.com'
const MINIMUM_YOUTUBE_FOLLOWERS = 2000
const ADMIN_CHANNEL_IDS = [
  'UCPtVsdtkwP3YNmObyTy1Lkw',
  'UCahnnOrHxWb-DqGg6EgGuxA',
  'UCoU-ZbKQHGijlWtm0PWiAlQ',
]

// Initialize Google API clients
const oauth = new google.auth.OAuth2(
  CLIENT_ID,
  process.env.GOOGLE_OAUTH_SECRET,
  process.env.APP_URL
)
google.options({
  auth: oauth,
})
const analytics = google.youtubeAnalytics('v2')
const youtube = google.youtube('v3')

async function linkYoutubeChannel(
  code: string,
  creatorId: mongoose.Types.ObjectId
): Promise<DocumentType<Creator>> {
  // Get creator
  const creator = await CreatorModel.findById(creatorId)
  if (creator == null) {
    throw new CustomError(400, errorNames.creatorNotFound)
  }
  // Create Youtuber
  const { youtuber, googleData } = await createYoutuberFromCode(code)
  // Ensure enough followers (except if admin)
  if (
    youtuber.subscriberCount < MINIMUM_YOUTUBE_FOLLOWERS &&
    !ADMIN_CHANNEL_IDS.includes(youtuber.channelId)
  ) {
    throw new CustomError(400, errorNames.notEnoughFollowers)
  }
  const updatedCreator = await attachYoutuberToCreator(creator, youtuber, googleData)
  return updatedCreator
}

interface CreatedYoutuber {
  youtuber: DocumentType<Youtuber>
  googleData: GoogleData
}
export async function createYoutuberFromCode(code: string): Promise<CreatedYoutuber> {
  // Parse code to get Youtube stuff
  const googleData = await checkGoogleToken(code)
  const report = await getChannelReport(googleData.googleAccessToken)
  const videos = await getChannelVideos(report.uploadsPlaylistId)
  const youtuber = await createYoutuberFromReport(report, videos)
  return { youtuber, googleData }
}

async function checkGoogleToken(code: string): Promise<GoogleData> {
  // Exchange the code for tokens
  try {
    const { tokens } = await oauth.getToken(code)
    oauth.setCredentials(tokens)
    const ticket = await oauth.verifyIdToken({
      idToken: tokens.id_token,
      audience: CLIENT_ID,
    })
    const payload = ticket.getPayload()
    if (!payload || !payload.name || !payload.picture) {
      throw new Error(errorNames.invalidPayload)
    }
    return {
      name: payload.name,
      picture: payload.picture,
      email: payload.email,
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token,
    }
  } catch (error) {
    // Handle invalid token
    throw new CustomError(400, errorNames.invalidToken)
  }
}

async function getChannelReport(accessToken: string): Promise<IChannelReport> {
  const twoYearsAgo = moment()
    .subtract(2, 'years')
    .format('YYYY-MM-DD')
  const now = moment().format('YYYY-MM-DD')
  const baseReportQuery = {
    access_token: accessToken,
    metrics: 'viewerPercentage',
    // startDate: '2013-01-01', // Just to have data to copy
    startDate: twoYearsAgo, // Completely arbitrary
    endDate: now,
    ids: 'channel==MINE',
  }

  // Prepare all the requests to Youtube's APIs
  const agePromise = analytics.reports.query({
    ...baseReportQuery,
    dimensions: 'ageGroup',
  })
  const genderPromise = analytics.reports.query({
    ...baseReportQuery,
    dimensions: 'gender',
  })
  const countryPromise = analytics.reports.query({
    ...baseReportQuery,
    dimensions: 'country',
    metrics: 'views',
  })

  const cpm = await analytics.reports.query({
    ...baseReportQuery,
    metrics: 'playbackBasedCpm',
  })

  // Execute the API calls in parallel
  const channelsList = await youtube.channels.list({
    oauth_token: accessToken,
    mine: true,
    maxResults: 1,
    part: 'statistics,snippet,contentDetails',
  })
  const rawResponses = await Promise.all([agePromise, genderPromise, countryPromise])

  // Parse basic channel data
  const channel = channelsList.data.items && channelsList.data.items[0]
  if (!channel || !channel.statistics || !channel.snippet || !channel.contentDetails) {
    throw new Error(errorNames.invalidPayload)
  }
  // channel.contentDetails.relatedPlaylists.uploads
  const { subscriberCount, videoCount, viewCount } = channel.statistics
  // Parse audience analytics data
  const [age, gender, country] = rawResponses.map(
    _response => _response.data.rows
  ) as RawYoutubeMetric[]

  // Format all the fetched data into a report
  const channelReport: IChannelReport = {
    audienceAge: age,
    audienceGender: gender,
    audienceCountry: country,
    viewCount: parseInt(viewCount),
    subscriberCount: parseInt(subscriberCount),
    videoCount: parseInt(videoCount),
    channelId: channel.id,
    name: channel.snippet.title,
    thumbnail: channel.snippet.thumbnails.default.url,
    country: channel.snippet.country,
    language: channel.snippet.defaultLanguage,
    uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads,
    estimatedCpm: cpm.data.rows[0][0],
    url:
      channel.snippet.customUrl == null
        ? `https://www.youtube.com/channel/${channel.id}`
        : `https://www.youtube.com/user/${channel.snippet.customUrl}`,
  }
  return channelReport
}

async function getChannelVideos(uploadsPlaylistId: string): Promise<YoutubeVideo[]> {
  const playlistResponse = await youtube.playlistItems.list({
    playlistId: uploadsPlaylistId,
    maxResults: 40, // Max is 50, default 5
    part: 'contentDetails',
  })
  const videoIds = playlistResponse.data.items.map(_video => _video.contentDetails.videoId)
  const videosResponse = await youtube.videos.list({
    id: videoIds.join(','),
    part: 'snippet,statistics,id',
  })
  const rawVideos = videosResponse.data.items.map(
    _video =>
      ({
        videoId: _video.id,
        title: _video.snippet.title,
        viewCount: parseInt(_video.statistics.viewCount),
        likeCount: parseInt(_video.statistics.likeCount),
        commentCount: parseInt(_video.statistics.commentCount),
        publishedAt: new Date(_video.snippet.publishedAt),
        thumbnail: _video.snippet.thumbnails.high.url,
        url: `https://www.youtube.com/watch?v=${_video.id}`,
      } as YoutubeVideo)
  )
  return rawVideos
}

async function createYoutuberFromReport(
  report: IChannelReport,
  videos: YoutubeVideo[]
): Promise<DocumentType<Youtuber>> {
  const {
    name,
    channelId,
    viewCount,
    videoCount,
    subscriberCount,
    country,
    language,
    url,
    uploadsPlaylistId,
    estimatedCpm,
  } = report
  const youtuberDraft: Partial<Youtuber> = {
    name,
    channelId,
    viewCount,
    videoCount,
    subscriberCount,
    estimatedCpm,
    picture: report.thumbnail,
    url,
    videos,
    uploadsPlaylistId,
    audience: getAudienceFromReport(report),
  }

  // Use upsert so we can overwrite an existing youtuber
  const youtuber = await YoutuberModel.findOneAndUpdate(
    { channelId: youtuberDraft.channelId },
    {
      $set: youtuberDraft,
    },
    { upsert: true, new: true }
  )
  return youtuber
}

async function attachYoutuberToCreator(
  creator: DocumentType<Creator>,
  youtuber: DocumentType<Youtuber>,
  googleData: GoogleData
): Promise<DocumentType<Creator>> {
  // Use channel data to fill creator profile
  if (creator.name == null) {
    creator.name = youtuber.name
  }
  if (creator.picture == null) {
    // Upload user picture to cloudinary for longer persistence
    const cloudinaryUrl = await uploadToCloudinary(youtuber.picture, 'creator_picture')
    creator.picture = cloudinaryUrl
  }
  // Save the Google token for authenticated requests
  creator.googleAccessToken = googleData.googleAccessToken
  creator.googleRefreshToken = googleData.googleRefreshToken
  // Save relation to youtuber document
  creator.youtube = youtuber
  // Save and return with all changes
  await creator.save()
  return creator
}

export { linkYoutubeChannel, getChannelReport }
