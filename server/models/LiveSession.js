const mongoose = require('mongoose');

const liveSessionSchema = new mongoose.Schema(
  {
    roomName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    actualStart: {
      type: Date,
      required: true,
      index: true,
    },
    actualEnd: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['live', 'completed'],
      default: 'live',
      index: true,
    },
  },
  { timestamps: true }
);

liveSessionSchema.index({ mentorId: 1, actualStart: -1 });

module.exports = mongoose.model('LiveSession', liveSessionSchema);
