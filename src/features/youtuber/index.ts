import { google } from 'googleapis'
import { DocumentType } from '@hasezoey/typegoose'
import { CustomError, errorNames } from '../../utils/errors'
import { YoutubeVideo, Youtuber, YoutuberModel } from './model'

const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY })

async function getYoutuberById(youtuberId: string): Promise<DocumentType<Youtuber>> {
  const youtuber = await YoutuberModel.findById(youtuberId)
  if (youtuber == null) {
    throw new CustomError(400, errorNames.youtuberNotFound)
  }
  return youtuber
}

function getVideoIdFromYoutubeUrl(url: string): string {
  const matches = url.match(/^.*(youtu.be\/|v\/|e\/|u\/\w+\/|embed\/|v=)([^#&?]*).*/)
  return matches[2]
}

async function getYoutubeVideoData(videoId: string): Promise<YoutubeVideo> {
  const rawVideos = await youtube.videos.list({
    part: 'snippet,statistics',
    id: videoId,
  })
  const { snippet, statistics } = rawVideos.data.items[0]
  const video: YoutubeVideo = {
    thumbnail: snippet.thumbnails.maxres.url,
    title: snippet.title,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    videoId,
    viewCount: parseInt(statistics.viewCount),
    commentCount: parseInt(statistics.commentCount),
    likeCount: parseInt(statistics.likeCount),
    publishedAt: new Date(snippet.publishedAt),
  }
  return video
}

export * from './auth'
export * from './audience'
export { getYoutuberById, getYoutubeVideoData, getVideoIdFromYoutubeUrl }
