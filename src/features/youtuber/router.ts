import * as Router from 'koa-router'
import { Context } from 'koa'
import { errorNames } from '../../utils/errors'
import { getYoutuberById } from '.'

const router = new Router()

router.get('/:id/', async ctx => {
  const youtuber = await getYoutuberById(ctx.params.id)
  ctx.body = { youtuber }
})

export default router
