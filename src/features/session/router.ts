import * as Router from 'koa-router'
import { universalLogin, ISessionState } from '.'
import { getUserCampaignsAndCollabs } from '../campaign'
import { errorNames } from '../../utils/errors'
import { getExperiencesPage } from '../creator/experiences'
import { getCreatorCollabs } from '../collab'
import { getAmbassadorStatus } from '../creator'

interface ILoginInfo {
  email: string
  plainPassword: string
}

const router = new Router()

// Retrieve connected user (brand or influencer)
router.get('/', async ctx => {
  if (ctx.isAuthenticated()) {
    const { sessionType, ...user } = ctx.state.user as ISessionState
    if (sessionType === 'brand') {
      // Base brand session info
      const { campaigns, collabs, totalPages } = await getUserCampaignsAndCollabs(
        ctx.state.user.email
      )
      ctx.body = {
        sessionType,
        user,
        campaigns,
        totalPages,
        collabs,
      }
    } else {
      // Base creator session info
      const creatorId = ctx.state.user._id
      const { experiences: campaigns, totalPages } = await getExperiencesPage(creatorId)
      const collabs = await getCreatorCollabs(creatorId)
      const ambassadorStatus = await getAmbassadorStatus(creatorId)
      ctx.body = { sessionType, user, campaigns, collabs, totalPages, ambassadorStatus }
    }
  } else {
    ctx.throw(401, errorNames.unauthorized)
  }
})

// Start session (login) for brand or influencer
router.post('/', async ctx => {
  const loginInfo = ctx.request.body as ILoginInfo
  const { email, plainPassword } = loginInfo
  // Fetch user in database
  const sessionState = await universalLogin(email.toLowerCase(), plainPassword)
  await ctx.login(sessionState)
  if (sessionState.sessionType === 'brand') {
    const { campaigns, collabs, totalPages } = await getUserCampaignsAndCollabs(email)
    ctx.body = {
      ...sessionState,
      campaigns,
      totalPages,
      collabs,
    }
  } else {
    const creatorId = ctx.state.user.user._id
    const paginatedExperiences = await getExperiencesPage(creatorId)
    const { experiences: campaigns, totalPages } = paginatedExperiences
    const collabs = await getCreatorCollabs(creatorId)
    const ambassadorStatus = await getAmbassadorStatus(creatorId)
    ctx.body = { ...sessionState, campaigns, collabs, totalPages, ambassadorStatus }
  }
})

// Delete session (logout) for brand or influencer
router.delete('/', async ctx => {
  await ctx.logout()
  ctx.body = 'Logged out'
})

export default router
