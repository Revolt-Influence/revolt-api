import { BitlyClient } from 'bitly'
import dotenv from 'dotenv'
import agent from 'superagent'
import { ShortenResponse, BitlyResponseData, BitlyResponse } from 'bitly/dist/types'

dotenv.config()
const bitly = new BitlyClient(process.env.BITLY_ACCESS_TOKEN, { apiVersion: 'v3' })
const BITLY_API = 'https://api-ssl.bitly.com/v4'

async function bitlyGetRequest<T>(path: string): Promise<T> {
  const response = await agent
    .get(`${BITLY_API}${path}`)
    .set('Authorization', `Bearer ${process.env.BITLY_ACCESS_TOKEN}`)
  return response.body as T
}

async function bitlyPostRequest<T>(path: string, body: any = {}): Promise<T> {
  const response = await agent
    .post(`${BITLY_API}${path}`)
    .send(body)
    .set('Authorization', `Bearer ${process.env.BITLY_ACCESS_TOKEN}`)
  return response.body as T
}

interface CreateLinkResponse {
  link: string
  long_url: string
}
export async function createTrackedLink(longUrl: string): Promise<string> {
  const linkData = await bitlyPostRequest<CreateLinkResponse>('/bitlinks', { long_url: longUrl })
  return linkData.link
}

interface GetClicksSummaryResponse {
  total_clicks: number
}
export async function getTrackedLinkClicks(trackedLink: string): Promise<number> {
  // Remove HTTP and HTTPS
  const trimmedLink = trackedLink.replace('https://', '').replace('http://', '')
  // Make API call
  const clicksData = await bitlyGetRequest<GetClicksSummaryResponse>(
    `/bitlinks/${trimmedLink}/clicks/summary`
  )
  return clicksData.total_clicks
}
