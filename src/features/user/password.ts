import * as crypto from 'crypto'
import * as bcrypt from 'bcrypt'
import { DocumentType } from '@hasezoey/typegoose'
import { UserModel, User } from './model'
import { CustomError, errorNames } from '../../utils/errors'
import { emailService } from '../../utils/emails'
import { CreatorModel, Creator } from '../creator/model'
import { getFullCreatorById } from '../creator'

const upperCaseEnv = process.env.NODE_ENV.toUpperCase()
const appURL = process.env[`APP_URL_${upperCaseEnv}`]
const SALT_ROUNDS = 10

async function sendResetPasswordEmail(email: string): Promise<void> {
  // Find the right user
  const maybeUser = await UserModel.findOne({ email })
  const maybeCreator = await CreatorModel.findOne({ email })
  if (maybeUser == null && maybeCreator == null) {
    throw new CustomError(400, errorNames.userNotFound)
  }

  // Create and save a temporary reset password token
  const token = crypto.randomBytes(20).toString('hex')
  if (maybeUser != null) {
    maybeUser.resetPasswordToken = token
    maybeUser.resetPasswordExpires = Date.now() + 3600000
    await maybeUser.save()
  }
  if (maybeCreator != null) {
    maybeCreator.resetPasswordToken = token
    maybeCreator.resetPasswordExpires = Date.now() + 3600000
    await maybeCreator.save()
  }

  // Send the reset password link via email
  try {
    await emailService.send({
      template: 'resetPassword',
      message: {
        from: 'Revolt <noreply@revolt.club>',
        to: email,
      },
      locals: {
        link: `${appURL}/resetPassword/${token}`,
      },
    })
  } catch (error) {
    console.error(error)
    throw new CustomError(500, errorNames.resetPasswordEmailFail)
  }
}

async function resetPasswordViaEmail(token: string, newClearPassword: string): Promise<void> {
  // Find user whose reset token matches
  const maybeUser = await UserModel.findOne({ resetPasswordToken: token })
  const maybeCreator = await CreatorModel.findOne({ resetPasswordToken: token })

  // Check if token is valid
  const unknownEmail = maybeUser == null && maybeCreator == null
  const now = Date.now()
  const expiredUser = maybeUser != null && maybeUser.resetPasswordExpires < now
  const expiredCreator = maybeCreator != null && maybeCreator.resetPasswordExpires < now
  if (unknownEmail || expiredUser || expiredCreator) {
    // Handle errors
    throw new CustomError(400, errorNames.invalidLink)
  }

  // Token is valid, actually change password
  const newPasswordHash = await bcrypt.hash(newClearPassword, SALT_ROUNDS)
  if (maybeUser != null) {
    maybeUser.passwordHash = newPasswordHash
    maybeUser.resetPasswordToken = null
    maybeUser.resetPasswordExpires = null
    await maybeUser.save()
  } else if (maybeCreator != null) {
    maybeCreator.passwordHash = newPasswordHash
    maybeCreator.resetPasswordToken = null
    maybeCreator.resetPasswordExpires = null
    await maybeCreator.save()
  }
}

interface IChangePasswordPayload {
  email: string
  currentPassword: string
  newPassword: string
}
interface IChangePasswordResponse {
  user: DocumentType<User>
  creator: DocumentType<Creator>
}

async function changeUserOrCreatorPassword(
  newPasswordData: IChangePasswordPayload
): Promise<IChangePasswordResponse> {
  const { email, currentPassword, newPassword } = newPasswordData
  const maybeUser = await UserModel.findOne({ email })
  const maybeCreator = await CreatorModel.findOne({ email })
  // Check current password
  let isValidPassword = false
  if (maybeUser != null) {
    isValidPassword = await bcrypt.compare(currentPassword, maybeUser.passwordHash)
  }
  if (maybeCreator != null) {
    isValidPassword = await bcrypt.compare(currentPassword, maybeCreator.passwordHash)
  }
  if (!isValidPassword) {
    throw new CustomError(400, errorNames.wrongPassword)
  }
  // Actually change password
  const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
  if (maybeUser != null) {
    maybeUser.passwordHash = newPasswordHash
    await maybeUser.save()
  }
  if (maybeCreator != null) {
    maybeCreator.passwordHash = newPasswordHash
    await maybeCreator.save()
  }
  const fullCreator = maybeCreator == null ? null : await getFullCreatorById(maybeCreator._id)
  return { user: maybeUser, creator: fullCreator }
}

export { changeUserOrCreatorPassword, resetPasswordViaEmail, sendResetPasswordEmail }
