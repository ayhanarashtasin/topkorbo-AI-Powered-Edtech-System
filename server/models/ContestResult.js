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
    }
  },
  { timestamps: { createdAt: 'submittedAt', updatedAt: 'updatedAt' } }
);

// Ensure a student only has one official result record per contest
contestResultSchema.index({ contest: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('ContestResult', contestResultSchema);
