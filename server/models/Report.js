const mongoose = require('mongoose');

/**
 * Report Model - Handles user-submitted reports for content moderation.
 *
 * Supports polymorphic reporting via refPath: a single report schema
 * can target posts, comments, users, or questions without separate collections.
 *
 * Uses partial unique index to prevent duplicate active reports per user+target
 * while allowing re-reporting after resolution.
 */
const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    targetType: {
      type: String,
      enum: ['post', 'comment', 'user', 'question'],
      required: true
    },
    // Polymorphic reference: actual collection is determined dynamically by targetType
    target: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'targetType'
    },
    // Categorized reasons enable filtering by severity and type for admin workflows
    reason: {
      type: String,
      enum: [
        'spam',
        'harassment',
        'hate',
        'nudity',
        'misinformation',
        'cheating',
        'wrong_answer',
        'wrong_explanation',
        'typo',
        'duplicate',
        'outdated',
        'other'
      ],
      required: true
    },
    description: { type: String, default: '', maxlength: 1000 },
    // Lifecycle: open -> under_review -> resolved/dismissed/action_taken
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'dismissed', 'action_taken'],
      default: 'open'
    },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    // Describes admin action: "hidden", "warned", "banned", "dismissed"
    actionTaken: { type: String, default: '' },
    // Audit trail: multiple admins can add notes during review process
    adminNotes: {
      type: [
        {
          note: { type: String, required: true, maxlength: 1000 },
          addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
          addedAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

// Dashboard query: filter reports by status, newest first
reportSchema.index({ status: 1, createdAt: -1 });
// Target lookup: find all reports for a specific piece of content
reportSchema.index({ targetType: 1, target: 1, createdAt: -1 });
// Prevents duplicate active reports: unique per reporter+target when status is open/under_review
// Allows re-reporting after resolution (dismissed/resolved/action_taken)
reportSchema.index(
  { reporter: 1, targetType: 1, target: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['open', 'under_review'] } }
  }
);

module.exports = mongoose.model('Report', reportSchema);
