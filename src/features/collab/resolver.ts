import * as Router from 'koa-router'
import { Context } from 'koa'
import { Resolver, Mutation, Authorized, Arg, Ctx, InputType, Field } from 'type-graphql'
import { mongoose } from '@hasezoey/typegoose'
import { errorNames } from '../../utils/errors'
import { getCollabById, reviewCollab } from '.'
import { submitCreatorReviews, BaseReview, enrichAllReviews } from '../review'
import { Collab, ReviewCollabDecision } from './model'
import { AuthRole } from '../../middleware/auth'
import { MyContext } from '../session/model'
import { applyToExperience } from '../creator/experiences'
import { Review, ReviewFormat } from '../review/model'

@InputType()
class CollabReviewInput implements Partial<Review> {
  @Field()
  link: string

  @Field()
  format: ReviewFormat
}

@Resolver()
class CollabResolver {
  @Authorized(AuthRole.CREATOR)
  @Mutation(() => Collab, { description: 'Creates a collab' })
  async applyToExperience(
    @Arg('experienceId') experienceId: string,
    @Arg('message', { description: 'Motivation message' }) message: string,
    @Ctx() ctx: MyContext
  ): Promise<Collab> {
    const createdCollab = await applyToExperience(
      mongoose.Types.ObjectId(experienceId),
      ctx.state.user.creator._id,
      message
    )
    return createdCollab
  }

  @Authorized(AuthRole.USER)
  @Mutation(() => Collab, { description: 'Brand user accepts or denies a collab application' })
  async reviewCollabApplication(
    @Arg('collabId') collabId: string,
    @Arg('decision', { description: 'Whether the brand accepts or refuses the campaign' })
    decision: ReviewCollabDecision
  ): Promise<Collab> {
    const updatedCollab = await reviewCollab(mongoose.Types.ObjectId(collabId), decision)
    return updatedCollab
  }

  @Authorized(AuthRole.CREATOR)
  @Mutation(() => Collab, { description: 'End a collab by submitting the sponsored content' })
  async submitCollabReview(
    @Arg('collabId') collabId: string,
    @Arg('reviews', () => [CollabReviewInput]) reviews: CollabReviewInput[],
    @Ctx() ctx: MyContext
  ): Promise<Collab> {
    // Enrich and save reviews
    const savedReviews = await enrichAllReviews(
      reviews.map(_review => ({
        ..._review,
        creatorId: ctx.state.user.creator._id, // Add creator ID from context
      }))
    )
    // Save reviews in collab
    const updatedCollab = await submitCreatorReviews(collabId, savedReviews)
    return updatedCollab
  }
}

export { CollabResolver }
