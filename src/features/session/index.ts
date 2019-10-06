import passport from 'koa-passport'
import bcrypt from 'bcrypt'
import uuid from 'uuid/v4'
import { Strategy as LocalStrategy } from 'passport-local'
import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { UserInputError } from 'apollo-server-koa'
import { UserModel, User } from '../user/model'
import { Creator, CreatorModel } from '../creator/model'
import { CustomError, errorNames } from '../../utils/errors'
import { Session, SessionType, createDefaultSession } from './model'

export function createSessionId(id: string | mongoose.Types.ObjectId): string {
  return `session_${id}`
}

async function universalLogin(email: string, plainPassword: string): Promise<Session> {
  try {
    // Try User login first
    const user = await userLogin(email, plainPassword)
    // Return only happens if userLogin hasn't thrown an error
    return {
      isLoggedIn: true,
      sessionType: SessionType.BRAND,
      user,
      sessionId: createSessionId(user._id),
    }
  } catch (error) {
    try {
      // Then try Creator login
      const creator = await creatorLogin(email, plainPassword)
      // Return only happens if creatorLogin hasn't thrown an error
      return {
        isLoggedIn: true,
        sessionType: SessionType.CREATOR,
        creator,
        sessionId: createSessionId(creator._id),
      }
    } catch (error) {
      // Neither User nor Creator, throw an error
      throw new UserInputError(errorNames.loginFail)
    }
  }
}

async function userLogin(email: string, plainPassword: string): Promise<DocumentType<User>> {
  const user = await UserModel.findOne({ email })
  if (user == null) {
    // User does not exist
    throw new CustomError(422, errorNames.loginFail)
  }
  const { password } = user
  const isValidPassword = await bcrypt.compare(plainPassword, password)
  if (!isValidPassword) {
    // Invalid passport
    throw new CustomError(422, errorNames.loginFail)
  }
  return user
}

async function creatorLogin(email: string, plainPassword: string): Promise<DocumentType<Creator>> {
  const creator = await CreatorModel.findOne({ email }).populate('instagram youtube')
  if (creator == null) {
    // User does not exist
    throw new CustomError(422, errorNames.loginFail)
  }
  const { password } = creator
  const isValidPassword = await bcrypt.compare(plainPassword, password)
  if (!isValidPassword) {
    // Invalid passport
    throw new CustomError(422, errorNames.loginFail)
  }
  return creator
}

interface IKey {
  type: SessionType
  id: mongoose.Types.ObjectId
}

passport.serializeUser((session: Session, done) => {
  const getId = (): mongoose.Types.ObjectId | undefined => {
    switch (session.sessionType) {
      case SessionType.BRAND:
        return session.user && session.user._id
      case SessionType.CREATOR:
        return session.creator && session.creator._id
      default:
        return undefined
    }
  }
  const idToKeep = getId()
  const key = { type: session.sessionType, id: idToKeep } as IKey
  done(null, key)
})

passport.deserializeUser((key: IKey, done: (err: any, session: Session) => void) => {
  if (key.type === SessionType.BRAND) {
    UserModel.findById(key.id, (err, user) => {
      if (err != null || user == null) {
        return done(err, null)
      }
      const session: Session = {
        user,
        creator: null,
        isLoggedIn: true,
        sessionId: createSessionId(key.id),
        sessionType: SessionType.BRAND,
      }
      return done(err, session)
    })
  } else {
    CreatorModel.findById(key.id).exec((err, creator) => {
      if (err != null || creator == null) {
        return done(err, null)
      }
      const session: Session = {
        user: null,
        creator,
        isLoggedIn: true,
        sessionId: createSessionId(key.id),
        sessionType: SessionType.CREATOR,
      }
      return done(err, session)
    })
  }
})

passport.use(
  new LocalStrategy(async (email, password, done) => {
    try {
      const session = await universalLogin(email, password)
      return done(null, session)
    } catch (error) {
      return done(null, false)
    }
  })
)

export { passport, universalLogin, SessionType }
