import { Resolver, Query, Arg, InputType, Field, Ctx, Mutation, Authorized } from 'type-graphql'
import { mongoose } from '@hasezoey/typegoose'
import { User, UserModel, Plan } from './model'
import { Creator } from '../creator/model'
import { Session, createDefaultSession, SessionType, MyContext } from '../session/model'
import { createUser, updateUserContactInfo } from '.'
import { changeUserPassword } from './password'
import { AuthRole } from '../middleware/auth'

@InputType()
class SignupUserInput implements Partial<User> {
  @Field({ description: 'Used for login and notification and marketing emails' })
  email: string

  @Field({ description: 'Phone number is used for demo, customer support and conflicts' })
  phone: string

  @Field({ description: 'The password in plaintext, hashed on server' })
  password: string

  @Field({ description: 'Only used to score the lead, not a relation' })
  company: string

  @Field(() => Creator, { description: 'The creator who signed him up', nullable: true })
  ambassador?: mongoose.Types.ObjectId
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

  @Mutation(() => User, { description: 'Signup a brand user and start a session' })
  async signupUser(@Arg('user') user: SignupUserInput, @Ctx() ctx: MyContext): Promise<Session> {
    const createdUser = await createUser(user)
    // Check if a session already exists to keep its ID to update Apollo Client cache
    const sessionId = ctx.state.user.sessionId || createDefaultSession().sessionId
    return {
      sessionId,
      isLoggedIn: true,
      sessionType: SessionType.BRAND,
      user: createdUser,
    }
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
  @Mutation(() => User, { description: 'Change user email and/or phone' })
  async changeUserContactInfo(
    @Arg('newEmail') newEmail: string,
    @Arg('newPhone') newPhone: string,
    @Ctx() ctx: MyContext
  ): Promise<User> {
    const updatedUser = await updateUserContactInfo(ctx.state.user.user._id, newEmail, newPhone)
    return updatedUser
  }
}

export { UserResolver, SignupUserInput }
