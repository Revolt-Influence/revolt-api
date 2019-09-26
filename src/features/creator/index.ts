import * as bcrypt from 'bcrypt'
import * as superagent from 'superagent'
import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { CustomError, errorNames } from '../../utils/errors'
import { emailService } from '../../utils/emails'
import { Creator, CreatorModel, PostalAddress, CreatorStatus } from './model'
import { UserModel } from '../user/model'
import { Influencer, InfluencerModel } from '../influencer/model'
import { getLastPostCaptionFromData, getInfluencerFromData } from '../influencer'
import { uploadToCloudinary } from '../../utils/pictures'
import { CollabModel, CollabStatus } from '../collab/model'
import { ConversationModel } from '../conversation/model'

const SALT_ROUNDS = 10
const MINIMUM_INSTAGRAM_LIKES = 250
const ADMIN_USERNAMES = ['remiv2', 'remi.rvlt']
const CREATORS_PER_PAGE = 25

interface PaginatedCreators {
  totalPages: number
  currentPage: number
  creators: DocumentType<Creator>[]
}

async function getCreatorsPage(
  page: number,
  onlyWithLinkedNetworks: boolean,
  status?: CreatorStatus
): Promise<PaginatedCreators> {
  // Prevent page 0, starts at 1
  const safePage = page < 1 ? 1 : page
  // Optionally filter by status
  const query = {} as any
  if (status != null) {
    query.status = status
  }
  if (onlyWithLinkedNetworks) {
    query.$or = [
      { instagramIsVerified: true, instagram: { $exists: true } },
      { youtube: { $exists: true } },
    ]
  }

  const creatorsPromise = CreatorModel.find(query)
    .select(
      '-passwordHash -postalAddress -googleAccessToken -googleRefreshToken -resetPasswordToken -resetPasswordExpires'
    )
    .skip((safePage - 1) * CREATORS_PER_PAGE)
    .limit(CREATORS_PER_PAGE)
    .populate([
      {
        path: 'instagram',
        populate: {
          path: 'mentionedBrands',
        },
      },
      { path: 'youtube' },
    ])
    .sort({ signupDate: 'descending' }) // New to old
    .exec()
  const creatorsCountPromise = CreatorModel.find(query)
    .countDocuments()
    .exec()
  const [creators, creatorsCount] = await Promise.all([creatorsPromise, creatorsCountPromise])
  return {
    currentPage: safePage,
    totalPages: Math.ceil(creatorsCount / CREATORS_PER_PAGE),
    creators,
  }
}

async function getFullCreatorById(
  creatorId: mongoose.Types.ObjectId
): Promise<DocumentType<Creator>> {
  // Get creator from Mongo
  const creator = await CreatorModel.findById(creatorId)
    .select(
      '-passwordHash -postalAddress -googleAccessToken -googleRefreshToken -resetPasswordToken -resetPasswordExpires'
    )
    .populate([
      {
        path: 'instagram',
        populate: {
          path: 'mentionedBrands',
        },
      },
      { path: 'youtube' },
    ])
  // Check if creator exists
  if (creator == null) {
    throw new CustomError(400, errorNames.creatorNotFound)
  }
  return creator
}

async function signupCreator(
  creator: Creator,
  plainPassword: string
): Promise<DocumentType<Creator>> {
  // Check if data is complete
  if (
    creator == null ||
    creator.gender == null ||
    creator.country == null ||
    creator.language == null ||
    creator.birthYear == null
  ) {
    throw new CustomError(400, errorNames.invalidPayload)
  }

  // Make sure creator or a brand with same email doesn't already exist
  const existingCreator = await CreatorModel.findOne({ email: creator.email })
  const existingUser = await UserModel.findOne({ email: creator.email })
  if (existingCreator != null || existingUser != null) {
    console.log('Could not create ', creator.email)
    throw new CustomError(400, errorNames.creatorAlreadyExists)
  }

  // Actually create the creator
  const unverifiedCreator = new CreatorModel({
    ...creator,
    instagramIsVerified: false,
  } as Creator)
  // Hash password
  const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS)
  unverifiedCreator.passwordHash = hash
  // Prepare token
  const randomNumberToken = Math.floor(1000 + Math.random() * 9000)
  unverifiedCreator.instagramToken = randomNumberToken.toString()
  // Save unverified profile to mongoDB
  await unverifiedCreator.save()
  return unverifiedCreator
}

async function claimCreatorInstagramAccount(
  creator: DocumentType<Creator>,
  username: string
): Promise<DocumentType<Creator>> {
  // Save the claimed username
  creator.instagramUsername = username.toLowerCase().trim()
  await creator.save()
  // Populate and remove certain fields
  return getFullCreatorById(creator._id)
}

async function createInfluencerFromData(data: any): Promise<DocumentType<Influencer>> {
  // Get very basic profile info right away
  const influencerDraft = await getInfluencerFromData(data)
  // Use findOneAndUpdate to get upsert (create or update)
  const createdInfluencer = await InfluencerModel.findOneAndUpdate(
    { username: influencerDraft.username },
    {
      $set: influencerDraft,
    },
    { upsert: true, new: true }
  )

  // More advanced Instagram scraping in the background, including the community data
  if (process.env.NODE_ENV === 'production') {
    try {
      // No await, do it in the background
      superagent.get(
        `${process.env.PYTHON_API_URL}/?username=${createdInfluencer.username}&key=${
          process.env.PYTHON_API_KEY
        }`
      )
    } catch (error) {
      console.log(error)
    }
  }

  // Return created influencer
  return createdInfluencer
}

async function checkInstagramToken(
  creator: DocumentType<Creator>,
  influencerData: any
): Promise<DocumentType<Creator>> {
  const { instagramToken, instagramUsername } = creator
  const caption = await getLastPostCaptionFromData(influencerData)
  const influencer = await createInfluencerFromData(influencerData)
  // Only allow less than 5k followers if admin
  if (
    influencer.likes < MINIMUM_INSTAGRAM_LIKES &&
    !ADMIN_USERNAMES.includes(influencer.username)
  ) {
    throw new CustomError(400, errorNames.notEnoughFollowers)
  }
  if (caption.includes(`#check${instagramToken}`)) {
    // Instagram is legit, mark as verified
    creator.instagramIsVerified = true
    // Save relation
    creator.instagram = influencer._id
    // Save default picture
    if (creator.picture == null) {
      // Upload instagram picture to cloudinary
      creator.picture = await uploadToCloudinary(influencer.picture_url, 'creator_picture')
    }
    // Save default name
    if (creator.name == null) {
      creator.name = influencer.username
    }
    await creator.save()

    const maybeAmbassador = await CreatorModel.findById(creator.ambassador)

    // Notify the team that a creator signed up in the background
    emailService.send({
      template: 'creatorSignup',
      locals: {
        username: instagramUsername,
        email: creator.email,
        instagramToken: creator.instagramToken,
        ambassadorEmail: maybeAmbassador && maybeAmbassador.email,
        ambassadorName: maybeAmbassador && maybeAmbassador.name,
      },
      message: {
        from: 'Revolt <noreply@revolt.club>',
        to: process.env.CAMPAIGN_MANAGER_EMAIL,
      },
    })

    return getFullCreatorById(creator._id)
  }
  // Wrong code
  throw new CustomError(400, errorNames.invalidToken)
}

async function attachInfluencerToCreator(
  influencer: DocumentType<Influencer>
): Promise<DocumentType<Creator>> {
  // Use Regex to ignore casing, although all usernames should be lower
  const maybeCreator = await CreatorModel.findOne({
    instagramUsername: {
      $regex: new RegExp(`^${influencer.username}$`, 'i'),
    },
  })
  if (maybeCreator != null) {
    maybeCreator.instagram = influencer._id
    await maybeCreator.save()
  } else {
    return null
  }
}

async function saveCreatorProfile(
  creatorId: mongoose.Types.ObjectId,
  profile: { name: string; picture: string }
): Promise<DocumentType<Creator>> {
  // Safely get creator from Mongo
  const creator = await getFullCreatorById(creatorId)
  // Check if data is valid
  if (profile.name == null || profile.picture == null) {
    throw new CustomError(400, errorNames.invalidPayload)
  }
  // Update creator in Mongo
  creator.name = profile.name
  creator.picture = profile.picture
  await creator.save()
  return getFullCreatorById(creator._id)
}

async function saveCreatorPostalAddress(
  creatorId: string,
  postalAddress: PostalAddress
): Promise<DocumentType<Creator>> {
  const creator = await CreatorModel.findOne(creatorId)
  creator.postalAddress = postalAddress
  await creator.save()
  return getFullCreatorById(creator._id)
}

async function updateCreatorContactInfo(
  creatorId: mongoose.Types.ObjectId,
  email: string,
  phone: string
): Promise<DocumentType<Creator>> {
  // Check if there is payload
  if (email == null || phone == null) {
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
  const creator = await getFullCreatorById(creatorId)
  creator.email = email
  creator.phone = phone
  await creator.save()
  return creator
}

async function setCreatorStatus(
  creatorId: mongoose.Types.ObjectId,
  newStatus: CreatorStatus
): Promise<DocumentType<Creator>> {
  const creator = await getFullCreatorById(creatorId)
  creator.status = newStatus
  await creator.save()

  if (newStatus === CreatorStatus.blocked) {
    // Get rid of all unaccepted collabs and conversations
    await CollabModel.deleteMany({ creator: creatorId, status: CollabStatus.proposed })
    await ConversationModel.deleteMany({ creator: creatorId })
  }

  // Send email notification to creator in the background
  emailService.send({
    template: newStatus === CreatorStatus.blocked ? 'creatorRefused' : 'creatorAccepted',
    locals: {
      name: creator.name,
      homepageLink: process.env[`APP_URL_${process.env.NODE_ENV.toUpperCase()}`],
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

export {
  signupCreator,
  claimCreatorInstagramAccount,
  attachInfluencerToCreator,
  getFullCreatorById,
  checkInstagramToken,
  saveCreatorPostalAddress,
  saveCreatorProfile,
  updateCreatorContactInfo,
  getCreatorsPage,
  setCreatorStatus,
  getAmbassadorStatus,
}
