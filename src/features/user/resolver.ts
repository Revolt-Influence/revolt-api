import { Resolver, Query, Arg, InputType, Field, Ctx, Mutation, Authorized } from 'type-graphql'
import { mongoose } from '@hasezoey/typegoose'
import { User, UserModel, Plan } from './model'
import { Creator } from '../creator/model'
import { Session, createDefaultSession, SessionType, MyContext } from '../session/model'
import { createUser, updateUserEmail } from '.'
import { changeUserPassword, sendResetPasswordEmail, resetPasswordViaEmail } from './password'
import { AuthRole } from '../../middleware/auth'
import { switchToPremium, cancelPremium, updateCreditCard } from './billing'

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

@Resolver(User)
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
    const { sessionId } = createDefaultSession()
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

  @Authorized(AuthRole.USER)
  @Mutation(() => User, { description: 'Switch user to Premium plan' })
  async upgradeUser(
    @Arg('paymentToken') paymentToken: string,
    @Arg('firstName') firstName: string,
    @Arg('lastName') lastName: string,
    @Ctx() ctx: MyContext
  ): Promise<User> {
    const updatedUser = await switchToPremium(
      ctx.state.user.user._id,
      firstName,
      lastName,
      paymentToken
    )
    return updatedUser
  }

  @Authorized(AuthRole.USER)
  @Mutation(() => User, { description: 'Cancel user Premium plan to go back to free' })
  async downgradeUser(@Ctx() ctx: MyContext): Promise<User> {
    const updatedUser = await cancelPremium(ctx.state.user.user._id)
    return updatedUser
  }

  @Authorized(AuthRole.USER)
  @Mutation(() => User, { description: 'Change the card that Stripe charges for Premium' })
  async updateCreditCard(
    @Arg('newPaymentToken') newPaymentToken: string,
    @Ctx() ctx: MyContext
  ): Promise<User> {
    const updatedUser = await updateCreditCard(ctx.state.user.user._id, newPaymentToken)
    return updatedUser
  }

  @Mutation(() => String, {
    description: 'Send reset password link by email if creator or user forgot password',
  })
  async sendResetPasswordLink(@Arg('email') email: string): Promise<string> {
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
}

export { UserResolver, SignupUserInput }
