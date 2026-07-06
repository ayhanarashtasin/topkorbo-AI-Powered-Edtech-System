const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
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
      default: 'open',
      index: true
    },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    actionTaken: { type: String, default: '' } // e.g. "hidden_post", "warned_user"
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
