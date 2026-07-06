const mongoose = require('mongoose');

const adminNoticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    type: {
      type: String,
      enum: ['info', 'success', 'warning', 'danger'],
      default: 'info'
    },
    audience: {
      type: String,
      enum: ['all', 'students', 'teachers'],
      default: 'all'
    },
    location: {
      type: String,
      enum: ['homepage', 'student_dashboard', 'teacher_dashboard', 'all_dashboards'],
      required: true
    },
    startsAt: {
      type: Date,
      default: null
    },
    endsAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    archivedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

adminNoticeSchema.index({ status: 1, location: 1, audience: 1, startsAt: 1, endsAt: 1, createdAt: -1 });

module.exports = mongoose.model('AdminNotice', adminNoticeSchema);
