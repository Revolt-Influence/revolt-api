import {
  Resolver,
  Query,
  Arg,
  InputType,
  Field,
  Ctx,
  Mutation,
  Authorized,
  FieldResolver,
  Root,
} from 'type-graphql'
import { mongoose, DocumentType } from '@typegoose/typegoose'
import { User, UserModel, Plan } from './model'
import { Creator, CreatorModel } from '../creator/model'
import { Session, createDefaultSession, SessionType, MyContext } from '../session/model'
import { createUser, updateUserEmail } from '.'
import { changeUserPassword, sendResetPasswordEmail, resetPasswordViaEmail } from './password'
import { AuthRole } from '../../middleware/auth'
import {
  createStripeSession,
  saveUserPaymentMethod,
  checkIfUserHasPaymentMethod,
  getUserCardLast4,
} from './billing'
import { createSessionId } from '../session'

@InputType()
class SignupUserInput {
  @Field({ description: 'Used for login and notification and marketing emails' })
  email: string

  @Field({ description: 'The password in plaintext, hashed on server' })
  password: string

  @Field({ description: 'Only used to score the lead, not a relation' })
  company: string

  @Field({ description: 'The ID of the creator who signed him up', nullable: true })
  ambassador?: string
}

@Resolver(() => User)
class UserResolver {
  @Query(() => User, { nullable: true, description: 'Get user by ID or email' })
  async user(
    @Arg('id', { nullable: true }) id?: string,
    @Arg('email', { nullable: true }) email?: string
  ): Promise<User | null> {
    if (id) {
      return UserModel.findById(id)
    }
    if (email) {
      return UserModel.findOne({ email })
    }
    return null
  }

  @Mutation(() => Session, { description: 'Signup a brand user and start a session' })
  async signupUser(@Arg('user') user: SignupUserInput, @Ctx() ctx: MyContext): Promise<Session> {
    // Create user
    const createdUser = await createUser(user)
    // Generate session ID to help Apollo Client cache data
    const sessionId = createSessionId(createdUser._id)
    const newSessionData: Session = {
      sessionId,
      isLoggedIn: true,
      sessionType: SessionType.BRAND,
      user: createdUser,
    }
    // Save session data in a cookie
    await ctx.login(newSessionData)
    // Send to client
    return newSessionData
  }

  @Authorized(AuthRole.USER)
  @Mutation(() => User, { description: 'Change user password' })
  async changeUserPassword(
    @Arg('currentPassword') currentPassword: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() ctx: MyContext
  ): Promise<User> {
    const updatedUser = await changeUserPassword({
      userId: ctx.state.user.user._id,
      currentPassword,
      newPassword,
    })
    return updatedUser
  }

  @Authorized(AuthRole.USER)
  @Mutation(() => User, { description: 'Change user email' })
  async updateUserEmail(@Arg('newEmail') newEmail: string, @Ctx() ctx: MyContext): Promise<User> {
    const updatedUser = await updateUserEmail(ctx.state.user.user._id, newEmail)
    return updatedUser
  }

  @Mutation(() => String, {
    description: 'Send reset password link by email if creator or user forgot password',
  })
  async sendResetPasswordEmail(@Arg('email') email: string): Promise<string> {
    await sendResetPasswordEmail(email)
    return 'Email sent'
  }

  @Mutation(() => String, { description: 'Reset password from forgot password email link' })
  async resetPasswordViaEmail(
    @Arg('token') token: string,
    @Arg('newPassword') newPassword: string
  ): Promise<string> {
    await resetPasswordViaEmail(token, newPassword)
    return 'Password changed'
  }

  @Authorized(AuthRole.USER)
  @Mutation(() => String, {
    description: 'Create session token that will be used by Stripe Checkout',
  })
  async createStripeSession(@Ctx() ctx: MyContext): Promise<string> {
    const sessionId = await createStripeSession(ctx.state.user.user.email)
    return sessionId
  }

  @Authorized(AuthRole.USER)
  @Mutation(() => User, { description: 'Save payment method and link it to a Stripe customer' })
  async saveUserPaymentMethod(@Arg('token') token: string, @Ctx() ctx: MyContext): Promise<User> {
    const updatedUser = await saveUserPaymentMethod(token, ctx.state.user.user._id)
    return updatedUser
  }

  @FieldResolver()
  async ambassador(@Root() user: DocumentType<User>): Promise<Creator> {
    const ambassador = await CreatorModel.findById(user.ambassador)
    return ambassador
  }

  @FieldResolver()
  async hasPaymentMethod(@Root() user: DocumentType<User>): Promise<boolean> {
    return checkIfUserHasPaymentMethod(user)
  }

  @Authorized(AuthRole.USER)
  @FieldResolver()
  async creditCardLast4(@Root() user: DocumentType<User>): Promise<string> {
    const last4 = await getUserCardLast4(user)
    return last4
  }
}

export { UserResolver, SignupUserInput }
