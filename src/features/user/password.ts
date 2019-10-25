import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { DocumentType, mongoose } from '@typegoose/typegoose'
import { UserModel, User } from './model'
import { CustomError, errorNames } from '../../utils/errors'
import { emailService } from '../../utils/emails'
import { CreatorModel, Creator } from '../creator/model'

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
    maybeUser.resetPasswordExpiresAt = new Date(Date.now() + 3600000)
    await maybeUser.save()
  }
  if (maybeCreator != null) {
    maybeCreator.resetPasswordToken = token
    maybeCreator.resetPasswordExpiresAt = new Date(Date.now() + 3600000)
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
        link: `${process.env.APP_URL}/resetPassword/${token}`,
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
  const expiredUser =
    maybeUser &&
    maybeUser.resetPasswordExpiresAt &&
    maybeUser.resetPasswordExpiresAt.getSeconds() < now
  const expiredCreator =
    maybeCreator &&
    maybeCreator.resetPasswordExpiresAt &&
    maybeCreator.resetPasswordExpiresAt.getTime() < now
  if (unknownEmail || expiredUser || expiredCreator) {
    // Handle errors
    throw new CustomError(400, errorNames.invalidLink)
  }

  // Token is valid, actually change password
  const newpassword = await bcrypt.hash(newClearPassword, SALT_ROUNDS)
  if (maybeUser != null) {
    maybeUser.password = newpassword
    maybeUser.resetPasswordToken = undefined
    maybeUser.resetPasswordExpiresAt = undefined
    await maybeUser.save()
  } else if (maybeCreator != null) {
    maybeCreator.password = newpassword
    maybeCreator.resetPasswordToken = undefined
    maybeCreator.resetPasswordExpiresAt = undefined
    await maybeCreator.save()
  }
}

interface ChangeUserPasswordPayload {
  userId: mongoose.Types.ObjectId
  currentPassword: string
  newPassword: string
}

async function changeUserPassword({
  userId,
  currentPassword,
  newPassword,
}: ChangeUserPasswordPayload): Promise<User> {
  const user = await UserModel.findById(userId)
  if (!user) {
    throw new Error(errorNames.userNotFound)
  }
  // Check current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password)
  if (!isValidPassword) {
    throw new CustomError(400, errorNames.wrongPassword)
  }
  // Actually change password
  const newPasswordHashed = await bcrypt.hash(newPassword, SALT_ROUNDS)
  user.password = newPasswordHashed
  await user.save()
  return user
}

export { changeUserPassword, resetPasswordViaEmail, sendResetPasswordEmail }
