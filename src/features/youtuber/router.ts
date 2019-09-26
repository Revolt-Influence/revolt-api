import * as Router from 'koa-router'
import { Context } from 'koa'
import { errorNames } from '../../utils/errors'
import { getYoutuberById } from '.'

const router = new Router()

async function allowIfLoggedIn(ctx: Context, next: () => Promise<void>): Promise<void> {
  // Throw error if logged out
  if (ctx.isUnauthenticated()) {
    ctx.throw(401, errorNames.unauthorized)
  }
  // Continue if user is logged in
  await next()
}

router.use(allowIfLoggedIn)

router.get('/:id/', async ctx => {
  const youtuber = await getYoutuberById(ctx.params.id)
  ctx.body = { youtuber }
})

export default router
