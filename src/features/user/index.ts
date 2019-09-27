import * as bcrypt from 'bcrypt'
import { DocumentType } from '@hasezoey/typegoose'
import { User, UserModel } from './model'
import { errorNames, CustomError } from '../../utils/errors'
import { spammyDomains } from '../../utils/emails'
import { createHubspotContact } from './hubspot'
import { CreatorModel } from '../creator/model'
import { CampaignModel } from '../campaign/model'

const SALT_ROUNDS = 10

async function createUser(user: User, plainPassword: string): Promise<DocumentType<User>> {
  const { email } = user
  // Prevent duplicate users
  const maybeExistingUser = await UserModel.findOne({ email })
  const maybeExistingCreator = await CreatorModel.findOne({ email })
  if (maybeExistingUser != null || maybeExistingCreator != null) {
    throw new CustomError(400, errorNames.userAlreadyExists)
  }

  // Prevent spammy emails
  if (email.includes('+') || spammyDomains.some(domain => email.endsWith(`@${domain}`))) {
    throw new CustomError(400, errorNames.spammyAddress)
  }

  // Prevent signing up as Premium or Admin
  if (user.plan !== 'free') {
    throw new CustomError(400, errorNames.default)
  }

  // Create password hash
  const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS)
  const fullUser = { ...user, passwordHash: hash }

  // Save the user to MongoDB
  const createdUser = await UserModel.create(fullUser)

  if (process.env.NODE_ENV === 'production') {
    // Save to hubspot in the background
    createHubspotContact(fullUser)
  }

  // Return created data to frontend
  return createdUser
}

interface IUpdateUserInfoPayload {
  email: string
  phone: string
}

async function updateUserContactInfo(
  currentEmail: string,
  newContactInfo: IUpdateUserInfoPayload
): Promise<DocumentType<User>> {
  const { email, phone } = newContactInfo

  // Prevent spammy emails
  if (spammyDomains.some(domain => email.includes(domain))) {
    throw new CustomError(400, errorNames.spammyAddress)
  }

  // Prevent already used email
  const otherUser = await UserModel.findOne({ email })
  if (email !== currentEmail && otherUser != null) {
    throw new CustomError(400, errorNames.userAlreadyExists)
  }

  // Find and update user
  const user = await UserModel.findOne({ email: currentEmail })
  user.email = email
  user.phone = phone
  await user.save()

  return user
}

export * from './billing'
export * from './password'
export { createUser, updateUserContactInfo, IUpdateUserInfoPayload }
