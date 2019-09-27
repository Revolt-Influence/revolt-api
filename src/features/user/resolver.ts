import { Resolver, Query, Arg } from 'type-graphql'
import { User, UserModel } from './model'

@Resolver(User)
class UserResolver {
  @Query(returns => User, { nullable: true })
  async userById(@Arg('_id', { nullable: true }) _id: string): Promise<User> {
    return UserModel.findById(_id)
  }

  @Query(returns => User, { nullable: true })
  async userByEmail(@Arg('email', { nullable: true }) email: string): Promise<User> {
    return UserModel.findOne({ email })
  }
}

export { UserResolver }
