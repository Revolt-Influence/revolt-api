import * as mongoose from 'mongoose'
import * as dotenv from 'dotenv'

async function connectTestMongoose(done: jest.DoneCallback) {
  // Connect to the testing database if it's not already connected
  if (mongoose.connection.readyState === 0) {
    dotenv.config()
    const mongoURI = process.env.DB_URI_DEVELOPMENT
    try {
      await mongoose.connect(mongoURI, { useNewUrlParser: true })
    } catch (error) {
      throw error
    }
    done()
  }
}

async function disconnectTestMongoose(done) {
  await mongoose.disconnect()
  done()
}

export { connectTestMongoose, disconnectTestMongoose }
