const mongoose = require('mongoose');

const proctorViolationSchema = new mongoose.Schema({
  contestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest',
    required: true,
    index: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  violationType: {
    type: String,
    enum: ['MOBILE_PHONE_DETECTED', 'MULTIPLE_FACES', 'NO_FACE_DETECTED', 'TAB_SWITCH', 'FULLSCREEN_EXIT', 'CAMERA_FEED_LOST'],
    default: 'MOBILE_PHONE_DETECTED'
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  snapshotUrl: {
    type: String,
    required: true
  },
  questionIndex: {
    type: Number,
    default: 0
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['pending_review', 'confirmed_cheating', 'dismissed_false_positive'],
    default: 'pending_review'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewNote: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Compound index
proctorViolationSchema.index({ contestId: 1, studentId: 1, timestamp: -1 });

module.exports = mongoose.model('ProctorViolation', proctorViolationSchema);
