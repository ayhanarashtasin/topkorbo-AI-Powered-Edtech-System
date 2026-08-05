/**
 * Comment model for the forum system.
 *
 * Supports threaded discussions with nested replies, rich HTML content,
 * image attachments, mentions, and reactions. Comments are soft-deleted
 * (isHidden) rather than physically removed to preserve thread structure.
 */
const mongoose = require('mongoose');

/** Schema for image attachments stored via Cloudinary. */
const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: '' }
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null
    },
    contentHtml: { type: String, default: '' },
    contentText: { type: String, default: '' },
    images: { type: [imageSchema], default: [] },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reactionsCount: {
      like: { type: Number, default: 0 },
      love: { type: Number, default: 0 }
    },
    /** Denormalized count of direct replies to avoid aggregation on every page load. */
    repliesCount: { type: Number, default: 0 },
    /** Nesting level used for client-side indentation (capped at 12). */
    depth: { type: Number, default: 0 },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    /** Soft-delete flag: hides comment without removing it or breaking reply chains. */
    isHidden: { type: Boolean, default: false }
  },
  { timestamps: true }
);

/**
 * Composite indexes for efficient query patterns:
 * 1. Fetching visible comments for a post, ordered by creation time
 * 2. Loading child comments under a specific parent
 * 3. User profile pages listing their recent comments
 */
commentSchema.index({ post: 1, isHidden: 1, createdAt: 1, _id: 1 });
commentSchema.index({ post: 1, parent: 1, isHidden: 1, createdAt: 1 });
commentSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
