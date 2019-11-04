import cron from 'node-cron'
import { saveAllReviewsNewStats } from '../features/review'
import { emailService } from './emails'

export class CronTaskManager {
  constructor() {
    this.getNewReviewStats()
  }

  getNewReviewStats() {
    // Every day at 3am: '0 3 * * *'
    // Every 10 seconds '*/5 * * * * *'
    // cron.schedule('*/5 * * * * *', async () => {
    cron.schedule('0 3 * * *', async () => {
      // Sequantially update all review stats
      const { failedReviews, updatedCount } = await saveAllReviewsNewStats()
      // Notify of the task success
      console.log(`Updated stats for ${updatedCount} reviews, with ${failedReviews.length} errors`)
      await emailService.send({
        template: 'updateReviewStats',
        locals: {
          updatedCount,
          failedReviews,
        },
        message: {
          from: 'Revolt Gaming <campaigns@revoltgaming.co>',
          to: process.env.DEVELOPER_EMAIL,
        },
      })
    })
  }
}
