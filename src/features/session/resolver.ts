import * as Router from 'koa-router'
import { Resolver, Query, Ctx, Mutation, Arg } from 'type-graphql'
import { universalLogin } from '.'
import { getUserCampaignsAndCollabs } from '../campaign'
import { errorNames } from '../../utils/errors'
import { getExperiencesPage } from '../creator/experiences'
import { getCreatorCollabs } from '../collab'
import { getAmbassadorStatus } from '../creator'
import { Session, MyContext, createDefaultSession } from './model'

@Resolver()
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

  @Mutation({ description: 'Login a user or a creator' })
  async login(
    @Arg('email') email: string,
    @Arg('password') password: string,
    @Ctx() ctx: MyContext
  ): Promise<Session> {
    const session = await universalLogin(email.trim().toLowerCase(), password)
    await ctx.login(session)
    return session
  }

  @Mutation({ description: 'Destroy session for creator or user' })
  async logout(@Ctx() ctx: MyContext): Promise<Session> {
    await ctx.logout()
    return createDefaultSession()
  }
}

export default router
