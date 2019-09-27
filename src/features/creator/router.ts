import * as Router from 'koa-router'
import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { Creator, CreatorModel, CreatorStatus } from './model'
import {
  signupCreator,
  getFullCreatorById,
  saveCreatorProfile,
  updateCreatorContactInfo,
  getCreatorsPage,
  setCreatorStatus,
} from '.'
import { getExperiencesPage } from './experiences'
import { ISessionState } from '../session'
import { linkYoutubeChannel } from '../youtuber'
import { errorNames, CustomError } from '../../utils/errors'

const router = new Router()

// Get all creators
router.get('/', async ctx => {
  const page = ctx.query.page || 1
  const status = ctx.query.status as CreatorStatus
  ctx.body = await getCreatorsPage(parseInt(page), true, status)
})

// Get creator by ID
router.get('/:id', async ctx => {
  const { id } = ctx.params as { id: string }
  const creator = await getFullCreatorById(mongoose.Types.ObjectId(id))
  ctx.body = { creator }
})

router.post('/', async ctx => {
  const { creator, plainPassword } = ctx.request.body as {
    creator: Creator
    plainPassword: string
  }
  const createdCreator = await signupCreator(creator, plainPassword)
  await ctx.login({ user: createdCreator, sessionType: 'creator' } as ISessionState)
  ctx.body = { creator: createdCreator }
})

router.post('/contactInfo', async ctx => {
  if (ctx.isUnauthenticated()) {
    ctx.throw(401, errorNames.unauthorized)
  }
  const creatorId = ctx.state.user._id
  const { email, phone } = ctx.request.body as { email: string; phone: string }
  const updatedCreator = await updateCreatorContactInfo(creatorId, email, phone)
  ctx.body = { creator: updatedCreator }
})

router.post('/profile', async ctx => {
  const { picture, name } = ctx.request.body as { picture: string; name: string }
  const creatorId = ctx.state.user._id
  const updatedCreator = await saveCreatorProfile(creatorId, { picture, name })
  ctx.body = { creator: updatedCreator }
})

router.post('/linkYoutubeChannel', async ctx => {
  const { code } = ctx.request.body as { code: string }
  const updatedCreator = await linkYoutubeChannel(code, ctx.state.user._id)
  const { experiences, totalPages } = await getExperiencesPage(updatedCreator._id)
  ctx.body = { creator: updatedCreator, experiences, totalPages }
})

router.patch('/:creatorId/status', async ctx => {
  // Only allow admin users
  if (ctx.isUnauthenticated() || ctx.state.user.plan !== 'admin') {
    throw new CustomError(401, errorNames.unauthorized)
  }
  // Change the status
  const { status } = ctx.request.body as { status: CreatorStatus }
  const updatedCreator = await setCreatorStatus(ctx.params.creatorId, status)
  // Send updated creator to the client
  ctx.body = { creator: updatedCreator }
})

export default router
