/**
 * Reaction controller — handles the toggle logic for likes/loves on posts
 * and comments. Coordinates mutation, counter updates, reputation changes,
 * forum score recalculation, notifications, and real-time socket broadcasts
 * inside a single MongoDB transaction.
 */

const Reaction = require('../models/Reaction');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { notify } = require('../services/notificationService');
const { addReputation } = require('../services/reputationService');
const { recomputePostScore } = require('../services/forumScoreService');
const { getIO } = require('../socket');
const { withMongoTransaction } = require('../utils/mongoTransaction');

// Reputation points awarded to the target's author per reaction type.
const REPUTATION_DELTAS = { like: 5, love: 10 };

/**
 * Atomically creates, toggles, or switches a reaction within a session.
 * Uses optimistic concurrency with retries: each attempt verifies the
 * document state before mutating, so a concurrent change from another
 * request causes a retry rather than a silent overwrite.
 *
 * Returns { previous, next } describing the transition (either may be null
 * for create/remove).
 */
async function mutateReaction({ targetType, target, user, type, session }, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const existing = await Reaction.findOne({ targetType, target, user })
      .session(session)
      .lean();

    // No existing reaction — create a new one.
    if (!existing) {
      await Reaction.create([{ targetType, target, user, type }], { session });
      return { previous: null, next: type };
    }

    // Same reaction type already exists — remove it (toggle off).
    if (existing.type === type) {
      const removed = await Reaction.deleteOne({ _id: existing._id, type }).session(session);
      if (removed.deletedCount === 1) {
        return { previous: type, next: null };
      }
      continue;
    }

    // Different reaction type — switch it (e.g., like → love).
    // The query condition on the old type acts as an optimistic lock.
    const switched = await Reaction.updateOne(
      { _id: existing._id, type: existing.type },
      { $set: { type } },
      { session }
    );
    if (switched.modifiedCount === 1) {
      return { previous: existing.type, next: type };
    }
  }

  // All retries exhausted — a concurrent mutation won the race.
  const error = new Error('Reaction changed concurrently. Please try again.');
  error.statusCode = 409;
  throw error;
}

/**
 * Builds an aggregation pipeline stage that atomically adjusts the like/love
 * counters on the target document. Prevents negative counts by clamping at 0.
 */
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
   *
   * Toggle behaviour — same type removes the reaction; different type switches it.
   * Everything runs in a single transaction:
   *   1. Validate input and resolve the target model (Post or Comment).
   *   2. Mutate the reaction document (create / delete / switch).
   *   3. Update the parent document's reaction counters.
   *   4. Recompute the post's forum score (posts only).
   *   5. Adjust the author's reputation (skipped for self-reactions).
   *   6. Send a real-time notification to the author.
   *   7. Broadcast the updated counts to the forum room via socket.
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

      // Run the entire mutation sequence inside a single transaction so that
      // reaction, counter, reputation, and score changes are atomic.
      const result = await withMongoTransaction(async (session) => {
        const doc = await Model.findOne({ _id: target, isHidden: false }).session(session);
        if (!doc) return null;

        // Step 2: Perform the reaction mutation with optimistic concurrency.
        const transition = await mutateReaction({
          targetType,
          target,
          user: req.user.id,
          type,
          session
        });

        // Step 3: Atomically adjust the like/love counters on the target document.
        const updated = await Model.findOneAndUpdate(
          { _id: target, isHidden: false },
          counterUpdate(transition.previous, transition.next),
          { new: true, session, timestamps: false }
        );
        if (!updated) {
          const error = new Error(`${targetType} not found`);
          error.statusCode = 404;
          throw error;
        }

        // Step 4: Recompute the post's aggregate forum score (posts only).
        if (targetType === 'post') {
          await recomputePostScore(updated._id, { session });
        }

        // Step 5: Adjust author reputation. Net delta accounts for both
        // creating/removing and switching between reaction types.
        // Self-reactions are excluded to prevent reputation farming.
        const isOwnTarget = String(doc.author) === String(req.user.id);
        if (!isOwnTarget) {
          const reputationDelta =
            (transition.next ? REPUTATION_DELTAS[transition.next] : 0) -
            (transition.previous ? REPUTATION_DELTAS[transition.previous] : 0);
          await addReputation(doc.author, reputationDelta, { session });
        }

        return {
          counts: {
            like: updated.reactionsCount?.like || 0,
            love: updated.reactionsCount?.love || 0
          },
          userReaction: transition.next,
          author: String(doc.author),
          postId: targetType === 'post' ? String(target) : String(doc.post),
          preview: doc.contentText?.slice(0, 120) || '',
          // Only notify when someone else adds a reaction (not on remove or self-reaction).
          shouldNotify: !isOwnTarget && Boolean(transition.next)
        };
      });

      if (!result) {
        return res.status(404).json({ success: false, message: `${targetType} not found` });
      }

      // Step 6: Send a real-time notification to the target's author.
      // Fire-and-forget — notification failure must not break the response.
      if (result.shouldNotify) {
        const actor = await User.findById(req.user.id).select('name').lean();
        const io = getIO();
        await notify(io, {
          recipient: result.author,
          actor: req.user.id,
          type: result.userReaction,
          post: result.postId,
          comment: targetType === 'comment' ? target : undefined,
          message: `${actor?.name || 'Someone'} reacted with ${result.userReaction} on your ${targetType}.`,
          preview: result.preview
        }).catch(() => {});
      }

      // Step 7: Broadcast updated reaction counts to all connected clients
      // in the forum room and the specific post room.
      const io = getIO();
      const roomKey = `post:${result.postId}`;
      io.to(['forum', roomKey]).emit('reaction:update', {
        targetType,
        target: String(target),
        counts: result.counts,
        userId: String(req.user.id),
        userReaction: result.userReaction
      });

      return res.json({
        success: true,
        data: { counts: result.counts, userReaction: result.userReaction }
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = reactionController;
