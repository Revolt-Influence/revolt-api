import Stripe from 'stripe'
import dotenv from 'dotenv'
import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { User, UserModel, Plan } from './model'
import { CustomError, errorNames } from '../../utils/errors'
import { updateHubspotContact } from './hubspot'
import { CollabModel } from '../collab/model'
import { CampaignModel, Campaign } from '../campaign/model'
import { Creator } from '../creator/model'

dotenv.config()
const PLATFORM_COMMISSION_PERCENTAGE = 15

// Setup Stripe stuff
const upperCaseEnv = process.env.NODE_ENV && process.env.NODE_ENV.toUpperCase()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const premiumPlanId = 'plan_FeOlduEF2o9fdt'

async function createStripeCustomer(
  email: string,
  company: string
): Promise<Stripe.customers.ICustomer> {
  // Save customer on Stripe servers
  const customer = await stripe.customers.create({
    email,
    description: company,
  })
  // Return customer ID
  return customer
}

export async function createStripeSession(userEmail: string): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'setup',
    success_url: `${process.env.APP_URL}/brand/addedPaymentMethodCallback?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}`,
    customer_email: userEmail,
  })
  return session.id
}

async function attachPaymentMethodToUser(
  userId: mongoose.Types.ObjectId,
  paymentMethodId: string
): Promise<User> {
  // Check the user
  const user = await UserModel.findById(userId)

  // Get user associated Stripe account
  const getStripeCustomerId = async () => {
    if (user.stripeCustomerId) {
      // Keep the existing Stripe customer if there is one
      return user.stripeCustomerId
    }
    // Otherwise create a Stripe customer
    const customer = await createStripeCustomer(user.email, user.company)
    return customer.id
  }
  const stripeCustomerId = await getStripeCustomerId()

  // Attach payment method to stripe customer
  await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId })

  // Save updated Stripe customer to the user
  user.stripeCustomerId = stripeCustomerId
  await user.save()

  return user
}

export async function saveUserPaymentMethod(
  token: string,
  userId: mongoose.Types.ObjectId
): Promise<User> {
  // Get Stripe session from token
  const session = await stripe.checkout.sessions.retrieve(token)
  // Get setup intent from session
  const setupIntentId = session.setup_intent
  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId)
  // Get payment method from setup intent
  const paymentMethodId = setupIntent.payment_method
  // Save payment method to user
  const updatedUser = await attachPaymentMethodToUser(userId, paymentMethodId)
  return updatedUser
}

export async function checkIfUserHasPaymentMethod(user: User): Promise<boolean> {
  // Check if user has connected Stripe customer account
  const hasConnectedStripe = !!user.stripeCustomerId
  if (!hasConnectedStripe) {
    return false
  }
  // Check if Stripe customer account has payment methods
  const userMethods = await stripe.paymentMethods.list({
    customer: user.stripeCustomerId,
    type: 'card',
  })
  return userMethods.data.length > 0
}

export async function getUserCardLast4(user: DocumentType<User>): Promise<string> {
  if (!user.stripeCustomerId) return null
  const userMethods = await stripe.paymentMethods.list({
    customer: user.stripeCustomerId,
    type: 'card',
  })
  if (userMethods.data.length === 0) return null
  const { last4 } = userMethods.data[0].card
  return last4
}

// off_session exists in the docs but was missing from the types
interface FixedPaymentIntent extends Stripe.paymentIntents.IPaymentIntentCreationOptions {
  off_session: boolean
}
export async function chargeCollabQuote(collabId: mongoose.Types.ObjectId): Promise<void> {
  // Get quote amount and stripe users
  const { quote, campaign, creator } = await CollabModel.findById(collabId).populate(
    'campaign owner creator'
  )

  const brandUser = await UserModel.findById((campaign as Campaign).owner)
  const paymentMethods = await stripe.paymentMethods.list({
    customer: brandUser.stripeCustomerId,
    type: 'card',
  })
  if (paymentMethods.total_count === 0) {
    throw new Error(errorNames.noPaymentMethod)
  }

  // Calculate how much the platform keeps (x100 because s)
  const platformFee = quote * (PLATFORM_COMMISSION_PERCENTAGE / 100)

  // Actually charge the customer and send money to the creator
  await stripe.paymentIntents.create({
    amount: (quote + platformFee) * 100, // x100 because it's in cents
    currency: 'usd',
    customer: brandUser.stripeCustomerId,
    payment_method: paymentMethods.data[0].id,
    off_session: true,
    confirm: true,
    payment_method_types: ['card'],
    on_behalf_of: (creator as Creator).stripeConnectedAccountId,
    description: `${(campaign as Campaign).product.name} x ${(creator as Creator).name} collab`,
    application_fee_amount: platformFee * 100, // x100 because cents
    transfer_data: {
      // Once the card is charged, send all but the platform fee to the creator
      destination: (creator as Creator).stripeConnectedAccountId,
    },
  } as FixedPaymentIntent)
}
