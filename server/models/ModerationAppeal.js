const mongoose = require('mongoose');

const moderationAppealSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    accountStatusAtSubmission: {
      type: String,
      enum: ['active', 'suspended', 'banned'],
      default: 'active'
    },
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

moderationAppealSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ModerationAppeal', moderationAppealSchema);
