const mongoose = require('mongoose');

/**
 * ModerationAppeal Model - Allows users to appeal moderation actions (warnings, bans).
 *
 * Captures account status at time of submission to provide context for reviewers.
 * Supports admin notes for collaborative review and tracks reviewer assignment.
 */
const moderationAppealSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // Snapshot of account status when appeal was submitted - helps reviewers
    // understand the severity and context of the original action
    accountStatusAtSubmission: {
      type: String,
      enum: ['active', 'suspended', 'banned'],
      default: 'active'
    },
    // User's justification for why the moderation action should be reversed
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    adminNotes: {
      type: [
        {
          note: { type: String, required: true, maxlength: 1000 },
          addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
          addedAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// Admin dashboard: filter appeals by status, newest first
moderationAppealSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ModerationAppeal', moderationAppealSchema);
