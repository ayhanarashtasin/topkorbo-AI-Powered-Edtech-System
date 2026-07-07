const mongoose = require('mongoose');

/**
 * RatingHistory
 *
 * One document per (student, contest) — the persisted, real rating change a
 * student earned by participating in a contest that has ended. A student's
 * current rating is the `newRating` of their most recent entry; a student
 * with zero entries starts at rating 0.
 *
 * This is derived entirely from real ContestResult standings, never from
 * practice data, and is idempotent once written under the current rating rules.
 */
const ratingHistorySchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    contest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contest',
      required: true,
      index: true
    },
    contestName: { type: String, default: '' },
    contestDate: { type: Date, required: true },
    rank: { type: Number, required: true },
    participants: { type: Number, required: true },
    score: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    oldRating: { type: Number, required: true },
    newRating: { type: Number, required: true },
    delta: { type: Number, required: true }
  },
  { timestamps: true }
);

// A student is rated at most once per contest.
ratingHistorySchema.index({ student: 1, contest: 1 }, { unique: true });

module.exports = mongoose.model('RatingHistory', ratingHistorySchema);
