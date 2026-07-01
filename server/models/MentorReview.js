const mongoose = require('mongoose');

const mentorReviewSchema = new mongoose.Schema(
  {
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    isAnonymous: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

mentorReviewSchema.index({ mentor: 1, student: 1 }, { unique: true });
mentorReviewSchema.index({ mentor: 1, createdAt: -1 });

module.exports = mongoose.model('MentorReview', mentorReviewSchema);
