const mongoose = require('mongoose');

/**
 * Phase 2 hook — focus mode timer session log.
 * Phase 1 scaffolds the schema and routes so the UI can record session
 * starts/stops once focus mode ships without another migration.
 */
const studySessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    routineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyRoutine',
      required: true
    },
    dayId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
    completedDuringSession: { type: Boolean, default: false }
  },
  { timestamps: true }
);

studySessionSchema.index({ userId: 1, startedAt: -1 });
studySessionSchema.index({ userId: 1, segmentId: 1 });

module.exports = mongoose.model('StudySession', studySessionSchema);