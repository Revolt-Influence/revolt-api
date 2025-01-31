import Router from 'koa-router'
import { Resolver, Query, Ctx, Mutation, Arg } from 'type-graphql'
import { errorNames } from '../../utils/errors'
import { getCreatorCollabs } from '../collab'
import { getAmbassadorStatus } from '../creator'
import { Session, MyContext, createDefaultSession } from './model'
import { passport, universalEmailLogin, universalGoogleLogin } from '.'

@Resolver(() => Session)
class SessionResolver {
  @Query(() => Session, {
    description: 'Check if a session exists, could be a creator or a brand user',
  })
  async session(@Ctx() ctx: MyContext): Promise<Session> {
    // Get the session from passport
    if (ctx.isAuthenticated()) {
      return ctx.state.user
    }
    // Return default logged out session if session doesn't exists
    return createDefaultSession()
  }

  @Mutation(() => Session, { description: 'Login a user or a creator' })
  async loginWithEmail(
    @Arg('email') email: string,
    @Arg('password') password: string,
    @Ctx() ctx: MyContext
  ): Promise<Session> {
    const session = await universalEmailLogin(email.trim().toLowerCase(), password)
    await ctx.login(session)
    return session
  }

  @Mutation(() => Session, { description: 'Login a user or a creator' })
  async loginWithGoogle(
    @Arg('googleCode') googleCode: string,
    @Ctx() ctx: MyContext
  ): Promise<Session> {
    const session = await universalGoogleLogin(googleCode)
    await ctx.login(session)
    return session
  }

  @Mutation(() => Session, { description: 'Destroy session for creator or user' })
  async logout(@Ctx() ctx: MyContext): Promise<Session> {
    await ctx.logout()
    return createDefaultSession()
  }
}

export { SessionResolver }
