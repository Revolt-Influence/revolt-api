import * as Stripe from 'stripe'
import * as dotenv from 'dotenv'
import { DocumentType } from '@hasezoey/typegoose'
import { User, UserModel } from './model'
import { CustomError, errorNames } from '../../utils/errors'
import { updateHubspotContact } from './hubspot'

dotenv.config()

// Setup Stripe stuff
const upperCaseEnv = process.env.NODE_ENV.toUpperCase()
const secretKey = process.env[`STRIPE_SECRET_KEY_${upperCaseEnv}`]
const stripe = new Stripe(secretKey)
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
        creditCardLast4: (customer.sources.data[0] as any).last4,
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
  email: string,
  firstName: string,
  lastName: string,
  token: string
): Promise<DocumentType<User>> {
  // Find user in database
  const currentUser = await UserModel.findOne({ email })
  if (currentUser == null) {
    throw new CustomError(400, errorNames.userNotFound)
  }
  console.log('user to upgrade', currentUser.email)

  // Create or retrieve Stripe customer
  const fullName = `${firstName} ${lastName}`
  let stripeCustomerId: string
  if (currentUser.stripeCustomerId == null) {
    stripeCustomerId = await createCustomer(token, email, fullName)
    console.log('new stripe customer', stripeCustomerId)
  } else {
    const { stripeCustomerId: currentCustomerId } = currentUser
    stripeCustomerId = currentCustomerId
    // Find customer object
    const customer = await stripe.customers.retrieve(currentUser.stripeCustomerId)
    console.log('existing customer', customer.id)
    // Restore last 4 digits in database
    await UserModel.findOneAndUpdate(
      { email },
      {
        $set: {
          creditCardLast4: (customer.sources.data[0] as any).last4,
        },
      }
    )
  }

  // Subscribe customer to Premium plan
  await stripe.subscriptions.create({
    customer: stripeCustomerId,
    plan: premiumPlanId,
  })
  console.log('subscription created')

  // Save changes in database
  const now: number = Date.now()
  const updatedUser = await UserModel.findOneAndUpdate(
    { email },
    {
      $set: {
        firstName,
        lastName,
        plan: 'premium',
        switchToPremiumDate: now,
        lastCountResetDate: now,
        searchesCount: 0,
        profilesCount: 0,
      },
    },
    { new: true }
  )

  if (upperCaseEnv === 'PRODUCTION') {
    // Save changes in Hubspot in the background
    updateHubspotContact(updatedUser)
  }

  return updatedUser
}

async function cancelPremium(email: string): Promise<DocumentType<User>> {
  // Retrieve current user
  const currentUser = await UserModel.findOne({ email })
  if (currentUser == null) {
    throw new CustomError(400, errorNames.userNotFound)
  }

  // Find Stripe customer from user
  const customer = await stripe.customers.retrieve(currentUser.stripeCustomerId)
  if (customer == null) {
    throw new CustomError(400, errorNames.customerNotFound)
  }
  const subscriptionId = customer.subscriptions.data[0].id

  // Cancel customer subscription to Premium
  await stripe.subscriptions.del(subscriptionId)

  // Save changes in database
  const now: number = Date.now()
  const updatedUser = await UserModel.findOneAndUpdate(
    { email },
    {
      $set: {
        plan: 'free',
        switchToPremiumDate: null,
        lastCountResetDate: now,
        searchesCount: 0,
        profilesCount: 0,
        creditCardLast4: null,
      },
    },
    { new: true }
  )

  if (upperCaseEnv === 'PRODUCTION') {
    // Save changes in Hubspot in the background
    updateHubspotContact(updatedUser)
  }

  return updatedUser
}

async function updateCreditCard(email: string, token: string): Promise<DocumentType<User>> {
  // Find existing user in database
  const user = await UserModel.findOne({ email })
  if (user == null) {
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
  return UserModel.findOneAndUpdate(
    { email },
    {
      $set: {
        creditCardLast4: (updatedCustomer.sources.data[0] as any).last4,
      },
    },
    { new: true }
  )
}

export { createCustomer, switchToPremium, cancelPremium, updateCreditCard }
