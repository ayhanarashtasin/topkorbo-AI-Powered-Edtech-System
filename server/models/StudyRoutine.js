const mongoose = require('mongoose');

const SegmentSchema = new mongoose.Schema({
  time: { type: String, trim: true },
  subject: { type: String, trim: true },
  paper: { type: String, trim: true },
  chapter: { type: String, trim: true },
  task: { type: String, trim: true },
  completed: { type: Boolean, default: false },
  // Phase 1 additions — date-aware planning
  startAt: { type: Date, default: null },
  endAt: { type: Date, default: null },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  estimatedMinutes: { type: Number, default: null, min: 0 },
  // Phase 2 hook — server cron will flip this when reminder fires
  notified: { type: Boolean, default: false }
});

const DayRoutineSchema = new mongoose.Schema({
  day: { type: String, trim: true },
  // Phase 1 addition — real calendar date for this day
  dayDate: { type: Date, default: null },
  segments: [SegmentSchema]
});

const SubjectInfoSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  paper: { type: String, trim: true },
  chapters: [{ type: String, trim: true }]
});

const studyRoutineSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    examInfo: {
      examName: { type: String, trim: true },
      examDate: { type: Date },
      subjects: [SubjectInfoSchema]
    },
    studentProfile: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    // Phase 1 additions — explicit plan horizon
    startDate: { type: Date, default: null },
    durationDays: { type: Number, default: 30, min: 1, max: 365 },
    routine: [DayRoutineSchema]
  },
  { timestamps: true }
);

// Fast lookup of "today's day" for the current user
studyRoutineSchema.index({ userId: 1, 'routine.dayDate': 1 });

module.exports = mongoose.model('StudyRoutine', studyRoutineSchema);