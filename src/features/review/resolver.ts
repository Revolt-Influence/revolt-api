import { Resolver, FieldResolver, Root } from 'type-graphql'
import { DocumentType } from '@hasezoey/typegoose'
import { Review } from './model'
import { Creator, CreatorModel } from '../creator/model'

@Resolver(() => Review)
class ReviewResolver {
  @FieldResolver()
  async creator(@Root() review: DocumentType<Review>): Promise<Creator> {
    const creator = await CreatorModel.findById(review.creator)
    return creator
  }
}

export { ReviewResolver }
