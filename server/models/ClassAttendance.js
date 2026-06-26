const mongoose = require('mongoose');

const classAttendanceSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LiveSession',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leftAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

classAttendanceSchema.index({ classId: 1, studentId: 1, joinedAt: -1 });

module.exports = mongoose.model('ClassAttendance', classAttendanceSchema);
