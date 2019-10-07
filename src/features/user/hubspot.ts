import Hubspot from 'hubspot'
import dotenv from 'dotenv'
import { User, UserModel } from './model'

// Prepare env variables
dotenv.config()

const hubspot = new Hubspot({
  apiKey: process.env.HUBSPOT_API_KEY as string,
})

interface IHubspotProperty {
  property: string
  value: any
}

function getUserHubspotProperties(user: User): IHubspotProperty[] {
  return [
    {
      property: 'email',
      value: user.email,
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
      property: 'company',
      value: user.company == null ? '' : user.company,
    },
    {
      property: 'app_signup',
      // Round to nearest day by substracting modulo 1 day in milliseconds
      value: user.createdAt.getTime() - (user.createdAt.getTime() % (1000 * 60 * 60 * 24)),
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

export { createHubspotContact, updateHubspotContact }
