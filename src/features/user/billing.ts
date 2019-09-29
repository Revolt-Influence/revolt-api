import Stripe from 'stripe'
import dotenv from 'dotenv'
import { DocumentType, mongoose } from '@hasezoey/typegoose'
import { User, UserModel, Plan } from './model'
import { CustomError, errorNames } from '../../utils/errors'
import { updateHubspotContact } from './hubspot'

dotenv.config()

// Setup Stripe stuff
const upperCaseEnv = process.env.NODE_ENV && process.env.NODE_ENV.toUpperCase()
const secretKey = process.env.STRIPE_SECRET_KEY
const stripe = new Stripe(secretKey as string)
const premiumPlanId = 'plan_FeOlduEF2o9fdt'

async function createCustomer(token: string, email: string, fullName: string): Promise<string> {
  // Save customer on Stripe servers
  const customer = await stripe.customers.create({
    email,
    source: token,
    description: fullName,
  })

  // Save customer on database
  const user = await UserModel.findOneAndUpdate(
    { email },
    {
      $set: {
        stripeCustomerId: customer.id,
        creditCardLast4: (customer.sources && (customer.sources.data[0] as any)).last4,
        // creditCardLast4: (customer.sources.data[0] as any).last4,
      },
    }
  )
  if (user == null) {
    throw new CustomError(400, errorNames.userNotFound)
  }

  // Return customer ID
  return customer.id
}

async function switchToPremium(
  userId: mongoose.Types.ObjectId,
  firstName: string,
  lastName: string,
  token: string
): Promise<DocumentType<User>> {
  // Find user in database
  const user = await UserModel.findById(userId)
  if (!user) {
    throw new CustomError(400, errorNames.userNotFound)
  }

  // Create or retrieve Stripe customer
  const fullName = `${firstName} ${lastName}`
  let stripeCustomerId: string
  if (user.stripeCustomerId == null) {
    stripeCustomerId = await createCustomer(token, user.email, fullName)
  } else {
    const { stripeCustomerId: currentCustomerId } = user
    stripeCustomerId = currentCustomerId
    // Find customer object
    const customer = await stripe.customers.retrieve(user.stripeCustomerId)
    // Restore last 4 digits in database
    user.creditCardLast4 = (customer.sources && (customer.sources.data[0] as any)).last4
  }

  // Subscribe customer to Premium plan
  await stripe.subscriptions.create({
    customer: stripeCustomerId,
    plan: premiumPlanId,
  })

  // Save changes in database
  const now: number = Date.now()
  user.plan = Plan.PREMIUM
  user.switchedToPremiumAt = new Date()
  await user.save()
  // TODO: save firstName and lastName

  if (upperCaseEnv === 'PRODUCTION') {
    // Save changes in Hubspot in the background
    updateHubspotContact(user)
  }

  return user
}

async function cancelPremium(userId: mongoose.Types.ObjectId): Promise<DocumentType<User> | null> {
  // Retrieve current user
  const user = await UserModel.findById(userId)
  if (user == null) {
    throw new CustomError(400, errorNames.userNotFound)
  }

  // Find Stripe customer from user
  const customer = await stripe.customers.retrieve(user.stripeCustomerId)
  if (customer == null) {
    throw new CustomError(400, errorNames.customerNotFound)
  }
  const subscriptionId = customer.subscriptions.data[0].id

  // Cancel customer subscription to Premium
  await stripe.subscriptions.del(subscriptionId)

  // Save changes in database
  const now: number = Date.now()
  user.plan = Plan.FREE
  user.switchedToPremiumAt = undefined
  user.creditCardLast4 = undefined

  if (upperCaseEnv === 'PRODUCTION') {
    // Save changes in Hubspot in the background
    updateHubspotContact(user)
  }

  return user
}

async function updateCreditCard(
  userId: mongoose.Types.ObjectId,
  token: string
): Promise<DocumentType<User>> {
  // Find existing user in database
  const user = await UserModel.findById(userId)
  if (!user) {
    throw new CustomError(400, errorNames.userNotFound)
  }

  // Find existing customer
  const customer = await stripe.customers.retrieve(user.stripeCustomerId)
  if (customer == null) {
    throw new CustomError(400, errorNames.customerNotFound)
  }

  // Update customer with new card
  const updatedCustomer = await stripe.customers.update(user.stripeCustomerId, { source: token })

  // Save new card last 4 digits in database
  if (updatedCustomer && updatedCustomer.sources) {
    user.creditCardLast4 = (updatedCustomer.sources.data[0] as any).last4
    await user.save()
  }
  return user
}

export { createCustomer, switchToPremium, cancelPremium, updateCreditCard }
