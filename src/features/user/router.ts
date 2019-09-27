import * as Router from 'koa-router'
import {
  createUser,
  sendResetPasswordEmail,
  resetPasswordViaEmail,
  switchToPremium,
  cancelPremium,
  updateCreditCard,
  changeUserOrCreatorPassword,
  IUpdateUserInfoPayload,
  updateUserContactInfo,
} from '.'
import { User } from './model'
import { errorNames } from '../../utils/errors'
import { ISessionState } from '../session'

const router = new Router()

router.post('/', async ctx => {
  const body = ctx.request.body as { user: User; plainPassword: string }
  const { user, plainPassword } = body
  const createdUser = await createUser(user, plainPassword)
  await ctx.login({ user: createdUser, sessionType: 'brand' } as ISessionState)
  ctx.body = {
    sessionType: 'brand',
    user: createdUser,
  }
})

router.post('/contactInfo', async ctx => {
  if (ctx.isUnauthenticated()) {
    ctx.throw(401, errorNames.unauthorized)
  }
  const { email } = ctx.state.user
  const newUserInfo = ctx.request.body as IUpdateUserInfoPayload
  const updatedUser = await updateUserContactInfo(email, newUserInfo)
  ctx.body = updatedUser
})

router.post('/switchToPremium', async ctx => {
  // Only allow if authenticated
  if (ctx.isUnauthenticated()) {
    ctx.throw(401, errorNames.unauthorized)
  }
  console.log('Switch to premium data', ctx.request.body, ctx.state.user.email)
  const { email } = ctx.state.user
  const { token, firstName, lastName } = ctx.request.body as {
    token: string
    firstName: string
    lastName: string
  }

  // Update user in database
  const updatedUser = await switchToPremium(email, firstName, lastName, token)
  ctx.body = updatedUser
})

router.post('/cancelPremium', async ctx => {
  // Only allow if authenticated
  if (ctx.isUnauthenticated()) {
    ctx.throw(401, errorNames.unauthorized)
  }
  const { email } = ctx.state.user
  const updatedUser = await cancelPremium(email)
  ctx.body = updatedUser
})

router.post('/updateCreditCard', async ctx => {
  // Only allow if authenticated
  if (ctx.isUnauthenticated()) {
    ctx.throw(401, errorNames.unauthorized)
  }
  const { email } = ctx.state.user
  const { token } = ctx.request.body as { token: string }
  // Update user in database
  const updatedUser = await updateCreditCard(email, token)
  ctx.body = updatedUser
})

router.post('/password', async ctx => {
  if (ctx.isUnauthenticated()) {
    ctx.throw(401, errorNames.unauthorized)
  }
  const { email } = ctx.state.user
  const newUserInfo = ctx.request.body as { currentPassword: string; newPassword: string }
  const { user, creator } = await changeUserOrCreatorPassword({ ...newUserInfo, email })
  ctx.body = { user, creator }
})

router.post('/sendResetPasswordLink', async ctx => {
  // Only allow if logged out
  if (ctx.isAuthenticated()) {
    ctx.throw(401)
  }
  const { email } = ctx.request.body as { email: string }
  await sendResetPasswordEmail(email)
  ctx.body = 'Email sent'
})

router.post('/resetPasswordViaEmail', async ctx => {
  // Only allow if logged out
  if (ctx.isAuthenticated()) {
    ctx.throw(401)
  }
  const { token, newPassword } = ctx.request.body as any
  await resetPasswordViaEmail(token, newPassword)
  ctx.body = 'Password changed'
})

export default router
