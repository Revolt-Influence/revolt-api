import * as Router from 'koa-router'
import { Context } from 'koa'
import { errorNames } from '../../utils/errors'
import { formatDoubles, setDefaultCreatorsProfiles } from '.'
import { createMissingConversations, setConversationsArchivedStatus } from './conversations'

const router = new Router()

async function allowIfAdmin(ctx: Context, next: () => Promise<void>): Promise<void> {
  // Throw error if not admin
  if (ctx.isUnauthenticated() || ctx.state.user.plan !== 'admin') {
    ctx.throw(401, errorNames.unauthorized)
  }
  // Continue if user is admin
  await next()
}

async function extendTimeout(ctx: Context, next: () => Promise<void>): Promise<void> {
  // Extend request timeout
  ctx.request.socket.setTimeout(3600000)
  // Continue request
  await next()
}

// Restrict all routes to admins only and extend timeout
router.use(allowIfAdmin, extendTimeout)

router.patch('/formatDoubles', async ctx => {
  const updatedCount = await formatDoubles()
  ctx.body = `Formatted ${updatedCount} influencers`
})

router.patch('/setDefaultCreatorProfiles', async ctx => {
  const updatedCount = await setDefaultCreatorsProfiles()
  ctx.body = `Modified profiles for ${updatedCount} creators`
})

router.patch('/createMissingConvs', async ctx => {
  const createdCount = await createMissingConversations()
  ctx.body = `Created ${createdCount} missing convs`
})

router.patch('/setConvArchivedStatus', async ctx => {
  const updatedCount = await setConversationsArchivedStatus()
  ctx.body = `set ${updatedCount} convs archived status`
})

export default router
