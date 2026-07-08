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
    // ===== Live, point-based scoring during a running contest =====
    // Running point total accumulated while the contest is live (correct answers
    // add points, wrong answers apply a penalty). Floored at 0.
    livePoints: {
      type: Number,
      default: 0,
      index: true
    },
    // Per-question live state keyed by contest question _id:
    // { [questionId]: { attempts, solved, awarded, solvedAt } }
    perQuestion: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    // Timestamp of the last livePoints change — leaderboard tiebreak (earlier wins).
    lastPointsChangeAt: {
      type: Date,
      default: null
    },
    // Final points banked to the account at settlement (livePoints + rank bonus).
    pointsEarned: {
      type: Number,
      default: 0
    },
    // Final rank assigned at settlement.
    finalRank: {
      type: Number,
      default: null
    },
    // Set when the student finishes/submits the contest.
    isFinished: {
      type: Boolean,
      default: false
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
