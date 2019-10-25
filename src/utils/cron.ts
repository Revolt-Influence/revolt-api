import cron from 'node-cron'
import { saveAllReviewsNewStats } from '../features/review'

export class CronTaskManager {
  constructor() {
    this.getNewReviewStats()
  }

  getNewReviewStats() {
    // Every day at 3am: '0 3 * * *'
    // Every 10 seconds '*/5 * * * * *'
    cron.schedule('0 3 * * *', async () => {
      const updatedCount = await saveAllReviewsNewStats()
      console.log(`Updated stats for ${updatedCount} reviews`)
    })
  }
}
