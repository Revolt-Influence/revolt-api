import { Resolver, FieldResolver, Root } from 'type-graphql'
import { DocumentType } from '@typegoose/typegoose'
import { Review, ReviewStats, ReviewStatsModel } from './model'
import { Creator, CreatorModel } from '../creator/model'

@Resolver(() => Review)
class ReviewResolver {
  @FieldResolver()
  async creator(@Root() review: DocumentType<Review>): Promise<Creator> {
    const creator = await CreatorModel.findById(review.creator)
    return creator
  }

  @FieldResolver({ description: 'Last stat objects, recent to old' })
  async stats(@Root() review: DocumentType<Review>): Promise<ReviewStats[]> {
    const stats = await ReviewStatsModel.find({ review: review._id })
      .sort({ createdAt: -1 })
      .limit(20)
    return stats
  }
}

export { ReviewResolver }
