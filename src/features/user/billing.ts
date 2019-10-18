import Stripe from 'stripe'
import dotenv from 'dotenv'
import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { User, UserModel, Plan } from './model'
import { CustomError, errorNames } from '../../utils/errors'
import { updateHubspotContact } from './hubspot'

dotenv.config()

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
  return userMethods.total_count > 0
}
