import Router from 'koa-router'
import { Context } from 'koa'
import { Resolver, Query, Arg } from 'type-graphql'
import { errorNames } from '../../utils/errors'
import { getYoutuberById } from '.'
import { Youtuber, YoutuberModel } from './model'

@Resolver()
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
}

export { YoutuberResolver }
