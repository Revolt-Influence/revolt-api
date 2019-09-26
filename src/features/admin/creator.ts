import { CreatorModel } from '../creator/model'
import { uploadToCloudinary } from '../../utils/pictures'
import { Influencer } from '../influencer/model'

async function setDefaultCreatorsProfiles(): Promise<number> {
  // Get all creators
  const creators = await CreatorModel.find().populate('instagram')
  // Prepare promises that set name for each creator
  let updatedCount = 0
  const setNamePromises = creators.map(async _creator => {
    try {
      // Set the name if necessary
      let hasBeenUpdated = false
      if (_creator.name == null) {
        // Try to set instagram username
        if (_creator.populated('instagram') != null) {
          _creator.name = (_creator.instagram as Influencer).username
        } else {
          // Otherwise use email to create username
          const emailName = _creator.email.substring(0, _creator.email.indexOf('@'))
          _creator.name = emailName
        }
        hasBeenUpdated = true
      }
      if (_creator.picture == null) {
        // Try to set Instagram picture
        if (_creator.populated('instagram')) {
          try {
            _creator.picture = await uploadToCloudinary(
              (_creator.instagram as Influencer).picture_url,
              'creator_picture'
            )
            hasBeenUpdated = true
          } catch (error) {
            console.log(`Could not upload picture for ${_creator.email}`)
          }
        }
      }
      // Check if changes were made
      if (hasBeenUpdated) {
        updatedCount += 1
        // Save name to Mongo
        await _creator.save()
      }
    } catch (error) {
      console.log(`Failed for ${_creator.id} Error:`)
      console.log(error)
    }
  })
  // Execute all promises in parallel
  await Promise.all(setNamePromises)
  // Return how many names were set
  return updatedCount
}

export { setDefaultCreatorsProfiles }
