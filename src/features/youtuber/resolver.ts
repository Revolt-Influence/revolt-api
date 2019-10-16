import Router from 'koa-router'
import { Context } from 'koa'
import { Resolver, Query, Arg, FieldResolver, Root } from 'type-graphql'
import { DocumentType } from '@hasezoey/typegoose'
import { errorNames } from '../../utils/errors'
import { getYoutuberById } from '.'
import { Youtuber, YoutuberModel, YoutubeVideo } from './model'
import { Creator } from '../creator/model'
import { getMedian } from '../../utils/array'

@Resolver(() => Youtuber)
class YoutuberResolver {
  @Query(() => Youtuber, { description: 'Get Youtuber by ID' })
  async youtuber(@Arg('id') id: string): Promise<Youtuber> {
    const youtuber = await getYoutuberById(id)
    return youtuber
  }

  @Query(() => [Youtuber], { description: 'Get all Youtubers' })
  async youtubers(): Promise<Youtuber[]> {
    const youtubers = await YoutuberModel.find()
    return youtubers
  }

  @FieldResolver(() => [YoutubeVideo])
  videos(@Root() youtuber: DocumentType<Youtuber>): YoutubeVideo[] {
    return youtuber.videos.slice(0, 6)
  }

  @FieldResolver(() => Number)
  medianViews(@Root() youtuber: DocumentType<Youtuber>): number {
    const views = youtuber.videos.map(_video => _video.viewCount)
    const medianViewCount = getMedian(views)
    return medianViewCount
  }
}

export { YoutuberResolver }
