import { registerEnumType, Field, ObjectType, ID } from 'type-graphql'
import { DefaultState, DefaultContext } from 'koa'
import * as uuid from 'uuid/v4'

import { User } from '../user/model'
import { Creator } from '../creator/model'

enum SessionType {
  BRAND = 'brand',
  CREATOR = 'creator',
}
registerEnumType(SessionType, {
  name: 'SessionType',
  description: 'Whether the logged in user is a creator',
})

@ObjectType({ description: 'Details about the session or the lack of one' })
class Session {
  @Field({ description: 'Whether a session was found' })
  isLoggedIn: boolean

  @Field(() => SessionType, { nullable: true })
  sessionType?: SessionType

  @Field({ description: 'The user that _may_ be logged in', nullable: true })
  user?: User

  @Field({ description: 'The creator that _may_ be logged in', nullable: true })
  creator?: Creator

  @Field(() => ID, {
    description: 'UUID used to uniquely identify the session from the GQL client',
  })
  sessionId: string
}

interface StateSession extends DefaultState {
  user: Session
}

interface MyContext extends DefaultContext {
  login: (session: Session) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: () => boolean
  isUnauthenticated: () => boolean
  state: StateSession
}

function createDefaultSession(): Session {
  return {
    isLoggedIn: false,
    sessionId: uuid(),
  }
}

export { Session, MyContext, SessionType, createDefaultSession }
