import bcrypt from 'bcrypt'
import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { User, UserModel } from './model'
import { errorNames, CustomError } from '../../utils/errors'
import { createHubspotContact } from './hubspot'
import { CreatorModel } from '../creator/model'
import { CampaignModel } from '../campaign/model'
import { SignupUserInput } from './resolver'

const SALT_ROUNDS = 10

async function createUser(user: SignupUserInput): Promise<DocumentType<User>> {
  const { email } = user
  // Prevent duplicate users
  const maybeExistingUser = await UserModel.findOne({ email })
  const maybeExistingCreator = await CreatorModel.findOne({ email })
  if (maybeExistingUser != null || maybeExistingCreator != null) {
    throw new CustomError(400, errorNames.userAlreadyExists)
  }

  // Create password hash
  const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS)
  user.password = hashedPassword

  // Save the user to MongoDB
  const userDraft: Partial<User> = {
    ...user,
    ambassador: user.ambassador ? mongoose.Types.ObjectId(user.ambassador) : undefined,
  }
  const createdUser = await UserModel.create(userDraft)

  if (process.env.NODE_ENV === 'production') {
    // Save to hubspot in the background
    createHubspotContact(createdUser)
  }

  // Return created data to frontend
  return createdUser
}

async function updateUserContactInfo(
  userId: mongoose.Types.ObjectId,
  newEmail: string,
  newPhone: string
): Promise<DocumentType<User>> {
  // Find and update user
  const user = await UserModel.findById(userId)
  if (!user) {
    throw new Error(errorNames.userNotFound)
  }

  // Prevent already used email
  const maybeOtherUser = await UserModel.findOne({ email: newEmail })
  if (maybeOtherUser && maybeOtherUser._id !== userId) {
    throw new CustomError(400, errorNames.userAlreadyExists)
  }

  user.email = newEmail
  user.phone = newPhone
  await user.save()

  return user
}

export * from './billing'
export * from './password'
export { createUser, updateUserContactInfo }
