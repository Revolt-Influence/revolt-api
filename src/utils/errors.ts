import { Context } from 'koa'
import * as dotenv from 'dotenv'
import * as Sentry from '@sentry/node'

// Setup stuff
dotenv.config()
if (process.env.NODE_ENV === 'production') {
  Sentry.init({ dsn: process.env.SENTRY_URL })
}

const errorNames = {
  userAlreadyExists: 'User already exists',
  userNotFound: 'User not found',
  customerNotFound: 'Customer not found',
  listNotFound: 'List not found',
  wrongPassword: 'Wrong password',
  unauthorized: 'Unauthorized, you may need to login',
  loginFail: 'Login failed, invalid email or password',
  invalidLink: 'This link is not valid',
  guestPlanLimit: 'You reached the limit of the Guest plan',
  freePlanLimit: 'You reached the limit of the Free plan',
  pictureNotFound: 'Picture was not found',
  resetPasswordEmailFail: 'Could not send reset password email',
  sendConfirmEmailLinkFail: 'Could not send confirm email link',
  invalidEmailToken: 'Invalid email token',
  spammyAddress: 'Spammy email address',
  emailNotConfirmed: 'Email not confirmed',
  pageDoesNotExist: 'Page does not exist',
  invalidPayload: 'Invalid payload',
  invalidToken: 'Invalid token',
  // Campaign related
  campaignNotFound: 'Campaign not found',
  campaignAlreadyExists: 'Campaign already exists',
  default: 'Something went wrong',
  // Collab related
  collabNotFound: 'Collab not found',
  alreadyApplied: 'Already applied to collab',
  scrapeReviewFailed: 'Could not scrape review',
  // Review related
  reviewNotFound: 'Review not found',
  // Creator related
  creatorAlreadyExists: 'Creator already exists',
  creatorNotFound: 'Creator not found',
  youtuberNotFound: 'Youtuber not found',
  notEnoughFollowers: 'Not enough followers',
  // Conversation related
  conversationNotFound: 'Conversation not found',
}

class CustomError extends Error {
  statusCode: number

  constructor(statusCode: number, message?: string) {
    super(message)
    this.message = message || errorNames.default
    this.statusCode = statusCode
  }
}

function displayError(ctx: Context, error: CustomError): void {
  ctx.status = error.statusCode || 500
  ctx.body = error.message || errorNames.default
}

async function handleGlobalErrors(ctx: Context, next: () => Promise<any>): Promise<void> {
  try {
    await next()
  } catch (error) {
    ctx.status = error.statusCode || 500
    ctx.body = error.message || errorNames.default
    // Setup Sentry in production
    if (process.env.NODE_ENV === 'production') {
      Sentry.withScope(scope => {
        // Check if logged in
        const isLoggedIn = ctx.isAuthenticated()
        scope.setTag('logged-in', isLoggedIn ? 'true' : 'false')
        scope.setTag('route', ctx.request.path)
        scope.setTag('method', ctx.request.method)
        // Make sure the request doesn't contain a plain password
        const containsPassword =
          ctx.request.method.toUpperCase() === 'POST' &&
          (ctx.request.path === '/creator' ||
            ctx.request.path === '/user' ||
            ctx.request.path === '/session')
        // Log the request body in Sentry
        if (!containsPassword) {
          scope.setTag('body', JSON.stringify(ctx.request.body))
        }
        // Attach user details
        if (isLoggedIn) {
          scope.setUser({ email: ctx.state.user.email })
        }
        // Send to sentry
        Sentry.captureException(error)
      })
    }
    console.log(error.message || error)
  }
}

export { errorNames, CustomError, displayError, handleGlobalErrors }
