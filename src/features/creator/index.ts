import bcrypt from 'bcrypt'
import superagent from 'superagent'
import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { CustomError, errorNames } from '../../utils/errors'
import { emailService } from '../../utils/emails'
import { Creator, CreatorModel, CreatorStatus } from './model'
import { UserModel } from '../user/model'
import { uploadToCloudinary } from '../../utils/pictures'
import { CollabModel, CollabStatus } from '../collab/model'
import { ConversationModel } from '../conversation/model'
import { SignupCreatorInput, PaginatedCreatorResponse } from './resolver'

const SALT_ROUNDS = 10
const MINIMUM_INSTAGRAM_LIKES = 250
const ADMIN_USERNAMES = ['remiv2', 'remi.rvlt']
const CREATORS_PER_PAGE = 25

async function getCreatorsPage(
  page: number,
  onlyWithLinkedNetworks: boolean,
  status?: CreatorStatus
): Promise<PaginatedCreatorResponse> {
  // Prepare Mongo query
  // Prevent page 0, starts at 1
  const safePage = page < 1 ? 1 : page
  // Optionally filter by status
  const query = {} as any
  if (!status) {
    query.status = status
  }
  if (onlyWithLinkedNetworks) {
    query.$or = [
      { instagramIsVerified: true, instagram: { $exists: true } },
      { youtube: { $exists: true } },
    ]
  }

  // Execute the query with pagination data
  const creatorsPromise = CreatorModel.find(query)
    .skip((safePage - 1) * CREATORS_PER_PAGE)
    .limit(CREATORS_PER_PAGE)
    .sort({ signupDate: 'descending' }) // New to old
    .exec()
  const creatorsCountPromise = CreatorModel.find(query)
    .countDocuments()
    .exec()
  const [creators, creatorsCount] = await Promise.all([creatorsPromise, creatorsCountPromise])
  return {
    currentPage: safePage,
    totalPages: Math.ceil(creatorsCount / CREATORS_PER_PAGE),
    items: creators,
  }
}

async function createCreator(creator: SignupCreatorInput): Promise<DocumentType<Creator>> {
  // Make sure creator or a brand with same email doesn't already exist
  const existingCreator = await CreatorModel.findOne({ email: creator.email })
  const existingUser = await UserModel.findOne({ email: creator.email })
  if (existingCreator || existingUser) {
    console.log('Could not create ', creator.email)
    throw new CustomError(400, errorNames.creatorAlreadyExists)
  }

  // Actually create the creator
  const creatorDraft: Partial<Creator> = {
    ...creator,
    ambassador: creator.ambassador ? mongoose.Types.ObjectId(creator.ambassador) : undefined,
  }
  const savedCreator = new CreatorModel(creatorDraft)
  // Hash password
  const hashedPassword = await bcrypt.hash(creator.password, SALT_ROUNDS)
  savedCreator.password = hashedPassword
  // Save unverified profile to mongoDB
  await savedCreator.save()
  return savedCreator
}

async function saveCreatorProfile(
  creatorId: mongoose.Types.ObjectId,
  profile: { name: string; picture: string }
): Promise<DocumentType<Creator>> {
  // Safely get creator from Mongo
  const creator = await CreatorModel.findById(creatorId)
  // Check if data is valid
  if (profile.name == null || profile.picture == null) {
    throw new CustomError(400, errorNames.invalidPayload)
  }
  // Update creator in Mongo
  creator.name = profile.name
  creator.picture = profile.picture
  await creator.save()
  return creator
}

async function updateCreatorEmail(
  creatorId: mongoose.Types.ObjectId,
  email: string
): Promise<DocumentType<Creator>> {
  // Check if there is payload
  if (email == null) {
    throw new CustomError(400, errorNames.invalidPayload)
  }
  // Check if email is available
  const maybeUsersPromise = UserModel.find({ email }).exec()
  const maybeCreatorsPromise = CreatorModel.find({ email }).exec()
  const [maybeUsers, maybeCreators] = await Promise.all([maybeUsersPromise, maybeCreatorsPromise])
  if (maybeUsers.length > 0 || maybeCreators.length > 0) {
    throw new CustomError(400, errorNames.userAlreadyExists)
  }
  // Find and update creator
  const creator = await CreatorModel.findById(creatorId)
  creator.email = email
  await creator.save()
  return creator
}

async function setCreatorStatus(
  creatorId: mongoose.Types.ObjectId,
  newStatus: CreatorStatus
): Promise<DocumentType<Creator>> {
  const creator = await CreatorModel.findById(creatorId)
  creator.status = newStatus
  await creator.save()

  if (newStatus === CreatorStatus.BLOCKED) {
    // Get rid of all unaccepted collabs and conversations
    await CollabModel.deleteMany({ creator: creatorId, status: CollabStatus.APPLIED })
    await ConversationModel.deleteMany({ creator: creatorId })
  }

  // Send email notification to creator in the background
  emailService.send({
    template: newStatus === CreatorStatus.BLOCKED ? 'creatorRefused' : 'creatorAccepted',
    locals: {
      name: creator.name,
      homepageLink: process.env.APP_URL,
    },
    message: {
      from: 'Revolt <campaigns@revolt.club>',
      to: creator.email,
    },
  })

  // Creator was already populated, we can return it directly
  return creator
}

interface AmbassadorStatus {
  signups: number
  activeSignups: number
}
async function getAmbassadorStatus(creatorId: string): Promise<AmbassadorStatus> {
  // Get all creators that signed up through that ambassador
  const signedUpCreators = await CreatorModel.find({ ambassador: creatorId })
  // Flatten their IDs
  const signedUpIds = signedUpCreators.map(_creator => _creator._id)

  // Find the ones who had accepted collabs
  let activeSignups = 0
  // Check collabs for each signed up creator
  const checkCollabsPromises = signedUpIds.map(async _creatorId => {
    const successfulCollab = await CollabModel.findOne({
      creator: _creatorId,
      status: { $in: ['accepted', 'sent', 'done'] },
    })
    if (successfulCollab != null) {
      activeSignups += 1
    }
  })
  await Promise.all(checkCollabsPromises)

  // Return gathered data
  return {
    signups: signedUpIds.length,
    activeSignups,
  }
}

interface ChangeCreatorPasswordPayload {
  creatorId: mongoose.Types.ObjectId
  currentPassword: string
  newPassword: string
}
async function changeCreatorPassword({
  creatorId,
  currentPassword,
  newPassword,
}: ChangeCreatorPasswordPayload): Promise<Creator> {
  const creator = await CreatorModel.findById(creatorId)
  if (!creator) {
    throw new Error(errorNames.creatorNotFound)
  }
  // Check current password
  const isValidPassword = await bcrypt.compare(currentPassword, creator.password)
  if (!isValidPassword) {
    throw new CustomError(400, errorNames.wrongPassword)
  }
  // Actually change password
  const newPasswordHashed = await bcrypt.hash(newPassword, SALT_ROUNDS)
  creator.password = newPasswordHashed
  await creator.save()
  return creator
}

export {
  createCreator,
  saveCreatorProfile,
  updateCreatorEmail,
  getCreatorsPage,
  setCreatorStatus,
  getAmbassadorStatus,
  changeCreatorPassword,
}
