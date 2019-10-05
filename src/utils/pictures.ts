import superagent from 'superagent'

type CloudinaryPreset = 'creator_picture' | 'stories' | 'campaign_gift' | 'brand_logo'

async function uploadToCloudinary(
  picture: string | File,
  preset: CloudinaryPreset
): Promise<string> {
  const { body } = await superagent.post('https://api.cloudinary.com/v1_1/revolt/upload').send({
    file: picture,
    upload_preset: preset,
  })
  return body.secure_url
}

export { uploadToCloudinary }
