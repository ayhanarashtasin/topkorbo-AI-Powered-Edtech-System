const mongoose = require('mongoose');

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
    target: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'targetType'
    },
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
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'dismissed', 'action_taken'],
      default: 'open'
    },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    actionTaken: { type: String, default: '' }, // e.g. "hidden_post", "warned_user"
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

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, target: 1, createdAt: -1 });
reportSchema.index(
  { reporter: 1, targetType: 1, target: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['open', 'under_review'] } }
  }
);

module.exports = mongoose.model('Report', reportSchema);
