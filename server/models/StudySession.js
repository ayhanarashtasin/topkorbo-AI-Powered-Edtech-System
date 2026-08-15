const mongoose = require('mongoose');

const studySessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  routineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudyRoutine'
  },
  segmentId: {
    type: String
  },
  subject: {
    type: String
  },
  chapter: {
    type: String
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date
  },
  durationMinutes: {
    type: Number
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned'],
    default: 'active',
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model('StudySession', studySessionSchema);
