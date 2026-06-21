const mongoose = require('mongoose');

const subjectBreakdownSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    correct: { type: Number, default: 0 },
    wrong: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    score: { type: Number, default: 0 }
  },
  { _id: false }
);

const mockTestAttemptSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    config: {
      standards: [{ type: String }],
      questionType: { type: String, default: '' },
      duration: { type: Number, default: 0 },
      negativeMarking: { type: Boolean, default: false },
      totalQuestions: { type: Number, default: 0 }
    },
    summary: {
      score: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      wrong: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      timeTakenSeconds: { type: Number, default: 0 },
      writtenUploadedCount: { type: Number, default: 0 }
    },
    subjectBreakdown: {
      type: [subjectBreakdownSchema],
      default: []
    },
    ranking: {
      overallPosition: { type: Number, default: 1 },
      totalAttempts: { type: Number, default: 1 },
      percentile: { type: Number, default: 100 }
    }
  },
  { timestamps: true }
);

mockTestAttemptSchema.index({ student: 1, createdAt: -1 });
mockTestAttemptSchema.index({ 'summary.score': -1, createdAt: -1 });

module.exports = mongoose.model('MockTestAttempt', mockTestAttemptSchema);
