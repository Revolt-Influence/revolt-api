import { mongoose } from '@hasezoey/typegoose'
import { CollabModel } from '../collab/model'
import { ConversationModel, MessageModel } from '../conversation/model'
import { createConversation } from '../conversation'
import { Campaign } from '../campaign/model'

async function createMissingConversations(): Promise<number> {
  const collabs = await CollabModel.find().populate('campaign')
  let createdConvsCount = 0
  const checkCollabsPromises = collabs.map(async _collab => {
    const relatedConversation = await ConversationModel.findById(_collab.conversation)
    if (relatedConversation == null) {
      const oldConversationId = _collab.conversation
      console.log(`Missing conv ${_collab.conversation} for ${_collab._id}`)
      createdConvsCount += 1
      const newConversation = await createConversation(
        _collab.creator as mongoose.Types.ObjectId,
        (_collab.campaign as Campaign).settings.brand as mongoose.Types.ObjectId
      )
      // Link new conversation to collav
      _collab.conversation = newConversation._id
      await _collab.save()
      // Update old messages with new id
      await MessageModel.updateMany(
        { conversation: oldConversationId },
        { $set: { conversation: newConversation._id } }
      )
    }
  })
  await Promise.all(checkCollabsPromises)
  return createdConvsCount
}

async function setConversationsArchivedStatus(): Promise<number> {
  const convs = await ConversationModel.find().populate('messagesCount')
  const setArchivedPromises = convs.map(async _conv => {
    _conv.isArchived = _conv.messagesCount < 2
    await _conv.save()
  })
  await Promise.all(setArchivedPromises)
  return convs.length
}

export { createMissingConversations, setConversationsArchivedStatus }
