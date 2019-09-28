import { AuthChecker } from 'type-graphql'
import { MyContext, SessionType } from '../session/model'

enum AuthRole {
  CREATOR = 'creator',
  USER = 'user',
  ADMIN = 'admin',
}

const customAuthChecker: AuthChecker<MyContext> = ({ context }, roles: AuthRole[]) => {
  // Always ensure that @Authorized requests are from a logged in user/creator
  if (context.isUnauthenticated()) {
    return false
  }

  // Make sure the current user/creator is allowed
  const session = context.state.user

  if (roles.includes(AuthRole.CREATOR) && session.sessionType !== SessionType.CREATOR) {
    return false
  }
  if (roles.includes(AuthRole.USER) && session.sessionType !== SessionType.BRAND) {
    return false
  }
  if (roles.includes(AuthRole.ADMIN) && !session.user.isAdmin) {
    return false
  }

  // All checks passed, authorize request
  return true
}

export { customAuthChecker, AuthRole }
