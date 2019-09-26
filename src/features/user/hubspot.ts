import Hubspot from 'hubspot'
import * as dotenv from 'dotenv'
import { User, UserModel } from './model'

// Prepare env variables
dotenv.config()

const hubspot = new Hubspot({
  apiKey: process.env.HUBSPOT_API_KEY,
})

interface IHubspotProperty {
  property: string
  value: any
}

async function addAllUsersToHubspot() {
  // Find all users that are not admin
  const allUsers = await UserModel.find({ plan: { $ne: 'admin' } })
  // Add all to hubspot in parallel
  const addToHubspotPromises = allUsers.map(async user => {
    try {
      await createHubspotContact(user)
    } catch (error) {
      console.log('Could not create or update contact', error)
    }
  })
  await Promise.all(addToHubspotPromises)
}

function getUserHubspotProperties(user: User): IHubspotProperty[] {
  return [
    {
      property: 'email',
      value: user.email,
    },
    {
      property: 'should_contact',
      value: user.wantsHelp == null ? null : user.wantsHelp,
    },
    {
      property: 'uses_app',
      value: true,
    },
    {
      property: 'was_called',
      value: false,
    },
    {
      property: 'is_premium',
      value: user.plan === 'premium',
    },
    {
      property: 'phone',
      value: user.phone,
    },
    {
      property: 'company',
      value: user.company == null ? '' : user.company,
    },
    {
      property: 'confirmed_email',
      value: user.hasVerifiedEmail == null ? false : user.hasVerifiedEmail,
    },
    {
      property: 'app_signup',
      // Round to nearest day by substracting modulo 1 day in milliseconds
      value: user.signupDate - (user.signupDate % (1000 * 60 * 60 * 24)),
    },
  ]
}

async function createHubspotContact(user: User): Promise<void> {
  try {
    await hubspot.contacts.create({
      properties: getUserHubspotProperties(user),
    })
    console.log(`Added ${user.email}`)
  } catch (error) {
    console.log('Trying to update instead')
    await updateHubspotContact(user)
  }
}

async function updateHubspotContact(user: User): Promise<void> {
  const existingContact = await hubspot.contacts.getByEmail(user.email)
  await hubspot.contacts.update(existingContact.vid, {
    properties: getUserHubspotProperties(user),
  })
}

export { createHubspotContact, addAllUsersToHubspot, updateHubspotContact }
