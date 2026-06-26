const mongoose = require('mongoose');

const mentorConnectionSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
      index: true
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    respondedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

mentorConnectionSchema.index({ student: 1, mentor: 1 }, { unique: true });
mentorConnectionSchema.index({ mentor: 1, status: 1, requestedAt: -1 });

module.exports = mongoose.model('MentorConnection', mentorConnectionSchema);
