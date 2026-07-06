const mongoose = require('mongoose');

const contestResultSchema = new mongoose.Schema(
  {
    contest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contest',
      required: true,
      index: true
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    score: {
      type: Number,
      required: true
    },
    totalQuestions: {
      type: Number,
      required: true
    },
    timeTakenSeconds: {
      type: Number,
      required: true
    },
    answersSubmitted: {
      type: Number,
      default: 0
    },
    answers: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    isDisqualified: {
      type: Boolean,
      default: false
    },
    disqualificationReason: {
      type: String,
      default: ''
    },
    antiCheatStatus: {
      type: String,
      enum: ['none', 'flagged', 'cleared'],
      default: 'none',
      index: true
    },
    antiCheatReason: {
      type: String,
      default: ''
    },
    antiCheatReviewNote: {
      type: String,
      default: ''
    },
    antiCheatFlaggedAt: {
      type: Date,
      default: null
    },
    antiCheatReviewedAt: {
      type: Date,
      default: null
    },
    antiCheatFlaggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    antiCheatReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: { createdAt: 'submittedAt', updatedAt: 'updatedAt' } }
);

// Ensure a student only has one official result record per contest
contestResultSchema.index({ contest: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('ContestResult', contestResultSchema);
