import Router from 'koa-router'
import { Context } from 'koa'
import { Resolver, Mutation, Authorized, Arg, Ctx, InputType, Field, Query } from 'type-graphql'
import { mongoose } from '@hasezoey/typegoose'
import { errorNames } from '../../utils/errors'
import { getCollabById, reviewCollab, getCreatorCollabs } from '.'
import { submitCreatorReview, BaseReview, enrichReview } from '../review'
import { Collab, ReviewCollabDecision, CollabModel } from './model'
import { AuthRole } from '../../middleware/auth'
import { MyContext } from '../session/model'
import { applyToExperience } from '../creator/experiences'
import { Review, ReviewFormat } from '../review/model'

@InputType()
class SubmitCollabReviewInput implements Partial<Review> {
  @Field()
  link: string

  @Field(() => ReviewFormat, { description: 'What platform the review is posted on' })
  format: ReviewFormat
}

@Resolver(() => Collab)
class CollabResolver {
  @Authorized()
  @Query(() => Collab, { description: 'Get collab by ID' })
  async collab(@Arg('collabId') collabId: string): Promise<Collab> {
    const collab = await CollabModel.findById(collabId)
    return collab
  }

  @Authorized(AuthRole.CREATOR)
  @Query(() => [Collab], { description: 'Get list of creator collabs' })
  async collabs(@Ctx() ctx: MyContext): Promise<Collab[]> {
    const collabs = await getCreatorCollabs(ctx.state.user.creator._id)
    return collabs
  }

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
    @Arg('decision', () => ReviewCollabDecision, {
      description: 'Whether the brand accepts or refuses the campaign',
    })
    decision: ReviewCollabDecision
  ): Promise<Collab> {
    const updatedCollab = await reviewCollab(mongoose.Types.ObjectId(collabId), decision)
    return updatedCollab
  }

  @Authorized(AuthRole.CREATOR)
  @Mutation(() => Collab, { description: 'End a collab by submitting the sponsored content' })
  async submitCollabReview(
    @Arg('collabId') collabId: string,
    @Arg('review', () => SubmitCollabReviewInput) review: SubmitCollabReviewInput,
    @Ctx() ctx: MyContext
  ): Promise<Collab> {
    // Enrich and save reviews
    const savedReview = await enrichReview({
      ...review,
      creatorId: ctx.state.user.creator._id, // Add creator ID from context
    })
    // Save reviews in collab
    const updatedCollab = await submitCreatorReview(collabId, savedReview)
    return updatedCollab
  }
}

export { CollabResolver, SubmitCollabReviewInput }
