import passport from 'koa-passport'
import bcrypt from 'bcrypt'
import uuid from 'uuid/v4'
import { Strategy as LocalStrategy } from 'passport-local'
import { DocumentType, mongoose } from '@typegoose/typegoose'
import { UserInputError } from 'apollo-server-koa'
import { UserModel, User } from '../user/model'
import { Creator, CreatorModel } from '../creator/model'
import { CustomError, errorNames } from '../../utils/errors'
import { Session, SessionType, createDefaultSession } from './model'
import { checkGoogleToken } from '../youtuber'

export function createSessionId(id: string | mongoose.Types.ObjectId): string {
  return `session_${id}`
}

export async function universalEmailLogin(email: string, plainPassword: string): Promise<Session> {
  try {
    // Try User login first
    const user = await userEmailLogin(email, plainPassword)
    // Return only happens if userEmailLogin hasn't thrown an error
    return {
      isLoggedIn: true,
      sessionType: SessionType.BRAND,
      user,
      sessionId: createSessionId(user._id),
    }
  } catch (error) {
    try {
      // Then try Creator login
      const creator = await creatorEmailLogin(email, plainPassword)
      // Return only happens if creatorEmailLogin hasn't thrown an error
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

async function userEmailLogin(email: string, plainPassword: string): Promise<DocumentType<User>> {
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

async function creatorEmailLogin(
  email: string,
  plainPassword: string
): Promise<DocumentType<Creator>> {
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

export async function universalGoogleLogin(googleCode: string): Promise<Session> {
  // Check if the code is valid
  const { email } = await checkGoogleToken(googleCode)

  // Check if the code matches a saved user
  const maybeUser = await UserModel.findOne({ email })
  if (maybeUser) {
    return {
      isLoggedIn: true,
      sessionType: SessionType.BRAND,
      user: maybeUser,
      sessionId: createSessionId(maybeUser._id),
    }
  }

  // Check if the code matches a saved creator
  const maybeCreator = await CreatorModel.findOne({ email })
  if (maybeCreator) {
    return {
      isLoggedIn: true,
      sessionType: SessionType.CREATOR,
      creator: maybeCreator,
      sessionId: createSessionId(maybeCreator._id),
    }
  }

  // No user and no creator, login failed
  throw new UserInputError(errorNames.googleLoginFail)
}

interface Key {
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
  const key = { type: session.sessionType, id: idToKeep } as Key
  done(null, key)
})

passport.deserializeUser((key: Key, done: (err: any, session: Session) => void) => {
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

export { passport }
