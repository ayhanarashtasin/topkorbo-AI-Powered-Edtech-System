const Reaction = require('../models/Reaction');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { notify } = require('../services/notificationService');
const { addReputation } = require('../services/reputationService');
const { recomputePostScore } = require('../services/forumScoreService');
const { getIO } = require('../socket');

const REPUTATION_DELTAS = { like: 5, love: 10 };

async function mutateReaction({ targetType, target, user, type }, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const existing = await Reaction.findOne({ targetType, target, user }).lean();

    if (!existing) {
      try {
        await Reaction.create({ targetType, target, user, type });
        return { previous: null, next: type };
      } catch (error) {
        if (error.code === 11000) continue;
        throw error;
      }
    }

    if (existing.type === type) {
      const removed = await Reaction.deleteOne({ _id: existing._id, type });
      if (removed.deletedCount === 1) {
        return { previous: type, next: null };
      }
      continue;
    }

    const switched = await Reaction.updateOne(
      { _id: existing._id, type: existing.type },
      { $set: { type } }
    );
    if (switched.modifiedCount === 1) {
      return { previous: existing.type, next: type };
    }
  }

  const error = new Error('Reaction changed concurrently. Please try again.');
  error.statusCode = 409;
  throw error;
}

function counterUpdate(previous, next) {
  const deltas = { like: 0, love: 0 };
  if (previous) deltas[previous] -= 1;
  if (next) deltas[next] += 1;

  return [{
    $set: {
      'reactionsCount.like': {
        $max: [
          0,
          { $add: [{ $ifNull: ['$reactionsCount.like', 0] }, deltas.like] }
        ]
      },
      'reactionsCount.love': {
        $max: [
          0,
          { $add: [{ $ifNull: ['$reactionsCount.love', 0] }, deltas.love] }
        ]
      }
    }
  }];
}

const reactionController = {
  /**
   * POST /api/reactions
   * Body: { targetType: 'post'|'comment', target: id, type: 'like'|'love' }
   * Toggle behaviour: if a reaction of this type already exists, remove it;
   * otherwise remove any other-type reaction (one reaction per user per target),
   * then create the new one.
   */
  async toggle(req, res, next) {
    try {
      const { targetType, target, type } = req.body;
      if (!['post', 'comment'].includes(targetType)) {
        return res.status(400).json({ success: false, message: 'Invalid targetType' });
      }
      if (!['like', 'love'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Invalid reaction type' });
      }
      if (!target) return res.status(400).json({ success: false, message: 'target required' });

      const Model = targetType === 'post' ? Post : Comment;
      const doc = await Model.findById(target);
      if (!doc || doc.isHidden) {
        return res.status(404).json({ success: false, message: `${targetType} not found` });
      }

      const transition = await mutateReaction({
        targetType,
        target,
        user: req.user.id,
        type
      });

      const updated = await Model.findOneAndUpdate(
        { _id: target, isHidden: false },
        counterUpdate(transition.previous, transition.next),
        { new: true }
      );
      if (!updated) {
        // The target was hidden between validation and mutation. Restore the
        // previous reaction state so the reaction collection stays consistent.
        if (transition.previous) {
          await Reaction.findOneAndUpdate(
            { targetType, target, user: req.user.id },
            { $set: { type: transition.previous } },
            { upsert: true }
          );
        } else {
          await Reaction.deleteOne({ targetType, target, user: req.user.id });
        }
        return res.status(404).json({ success: false, message: `${targetType} not found` });
      }

      const counts = {
        like: updated.reactionsCount?.like || 0,
        love: updated.reactionsCount?.love || 0
      };
      const userReaction = transition.next;

      // Update trending score if it's a post
      if (targetType === 'post') {
        await recomputePostScore(updated._id);
      }

      if (String(doc.author) !== String(req.user.id)) {
        const reputationDelta =
          (transition.next ? REPUTATION_DELTAS[transition.next] : 0) -
          (transition.previous ? REPUTATION_DELTAS[transition.previous] : 0);
        const sideEffects = [addReputation(doc.author, reputationDelta)];
        if (transition.next) {
          sideEffects.push((async () => {
            const actor = await User.findById(req.user.id).select('name').lean();
            const io = getIO();
            await notify(io, {
              recipient: doc.author,
              actor: req.user.id,
              type: transition.next,
              post: targetType === 'post' ? target : doc.post,
              comment: targetType === 'comment' ? target : undefined,
              message: `${actor?.name || 'Someone'} reacted with ${transition.next} on your ${targetType}.`,
              preview: doc.contentText?.slice(0, 120) || ''
            });
          })());
        }
        // The reaction is already committed. Notification delivery must not
        // turn a successful toggle into a retryable 500 and duplicate it.
        await Promise.allSettled(sideEffects);
      }

      const io = getIO();
      const roomKey =
        targetType === 'post'
          ? `post:${String(target)}`
          : `post:${String(doc.post)}`;
      io.to(['forum', roomKey]).emit('reaction:update', {
        targetType,
        target: String(target),
        counts,
        userId: String(req.user.id),
        userReaction
      });

      return res.json({
        success: true,
        data: { counts, userReaction }
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = reactionController;
