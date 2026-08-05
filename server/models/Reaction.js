/**
 * Reaction model — represents a user's reaction (like/love) on a post or comment.
 * Enforces a one-reaction-per-user-per-target rule via a unique compound index.
 * Switching between reaction types updates the existing row rather than creating
 * a duplicate, keeping the reaction counts accurate.
 */

const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema(
  {
    // Polymorphic target — can point to either a Post or Comment document.
    // refPath dynamically resolves the model based on targetType.
    targetType: {
      type: String,
      enum: ['post', 'comment'],
      required: true
    },
    // ObjectId of the target document (Post or Comment). refPath links
    // to the correct model for population.
    target: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'targetType'
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['like', 'love'],
      required: true
    }
  },
  // Only track creation time — reactions are never updated in place,
  // only created or deleted, so updatedAt would be redundant.
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Ensures each user can have only one reaction per target. The controller
// relies on this constraint for upsert/switch logic and retry-on-conflict.
reactionSchema.index({ targetType: 1, target: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Reaction', reactionSchema);
