const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema({
  time: String,
  subject: String,
  paper: String,
  chapter: String,
  task: String,
  completed: { type: Boolean, default: false },
  startAt: Date,
  endAt: Date,
  priority: String,
  estimatedMinutes: Number,
  notified: { type: Boolean, default: false }
});

const routineDaySchema = new mongoose.Schema({
  day: Number,
  dayDate: Date,
  isRest: { type: Boolean, default: false },
  segments: [segmentSchema]
});

const studyRoutineSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    startDate: {
      type: Date,
      required: true
    },
    durationDays: {
      type: Number,
      default: 30
    },
    generatedUpTo: {
      type: Date
    },
    studentProfile: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    examInfo: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    routine: [routineDaySchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('StudyRoutine', studyRoutineSchema);
