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
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    scheduledStart: {
      type: Date,
      default: null,
      index: true,
    },
    durationMinutes: {
      type: Number,
      min: 15,
      max: 180,
      default: 60,
    },
    audienceType: {
      type: String,
      enum: ['all_accepted', 'selected'],
      default: 'all_accepted',
    },
    invitedStudents: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    actualStart: {
      type: Date,
      default: null,
      index: true,
    },
    actualEnd: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['scheduled', 'live', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
  },
  { timestamps: true }
);

liveSessionSchema.index({ mentorId: 1, actualStart: -1 });
liveSessionSchema.index({ mentorId: 1, scheduledStart: 1 });

// At most ONE LIVE session per mentor at any time.
//
// Race condition protection: concurrent /mentor/start requests that both
// pass the weekly-limit check would otherwise both insert a 'live' row and
// both succeed, exceeding the weekly quota and creating two simultaneous
// LiveKit rooms for one mentor. The partial unique index below makes
// LiveSession.create() the authoritative gate — the second insert fails
// with E11000, and the controller reconnects to the existing live session.
liveSessionSchema.index(
  { mentorId: 1 },
  {
    unique: true,
    name: 'one_live_per_mentor',
    partialFilterExpression: { status: 'live' },
  },
);

module.exports = mongoose.model('LiveSession', liveSessionSchema);
