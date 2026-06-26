const StudyRoutine = require('../models/StudyRoutine');
const StudySession = require('../models/StudySession');
const { backfillDates, toISODate, startOfDay } = require('../utils/recurrence');

function userIdFrom(req) {
  return req.user._id || req.user.id;
}

/**
 * Normalize an incoming routine so dayDate / startAt / endAt are stored as
 * proper Date objects even if the client (or AI) sent ISO strings. Also
 * defaults priority / estimatedMinutes when missing.
 */
function normalizeRoutine(routine) {
  if (!Array.isArray(routine)) return [];
  return routine.map((day) => {
    const out = { ...day };
    if (out.dayDate) {
      const d = new Date(out.dayDate);
      out.dayDate = isNaN(d.getTime()) ? null : d;
    }
    if (Array.isArray(out.segments)) {
      out.segments = out.segments.map((seg) => {
        const s = { ...seg };
        if (s.startAt) {
          const d = new Date(s.startAt);
          s.startAt = isNaN(d.getTime()) ? null : d;
        }
        if (s.endAt) {
          const d = new Date(s.endAt);
          s.endAt = isNaN(d.getTime()) ? null : d;
        }
        if (s.priority && !['high', 'medium', 'low'].includes(s.priority)) {
          s.priority = 'medium';
        }
        if (typeof s.completed !== 'boolean') s.completed = false;
        return s;
      });
    }
    return out;
  });
}

exports.getRoutine = async (req, res, next) => {
  try {
    const routine = await StudyRoutine.findOne({ userId: userIdFrom(req) });
    res.status(200).json({
      success: true,
      data: { routine }
    });
  } catch (err) {
    next(err);
  }
};

exports.saveRoutine = async (req, res, next) => {
  try {
    const { routine, examInfo, studentProfile, startDate, durationDays } = req.body;
    if (!routine || !Array.isArray(routine)) {
      return res.status(400).json({ success: false, message: 'Invalid routine format' });
    }
    const userId = userIdFrom(req);

    const normalized = backfillDates(normalizeRoutine(routine), {
      wakeUpHour: 7,
      defaultSegmentMinutes: 90
    });

    let studyRoutine = await StudyRoutine.findOne({ userId });
    if (studyRoutine) {
      studyRoutine.routine = normalized;
      if (examInfo) studyRoutine.examInfo = examInfo;
      if (studentProfile) studyRoutine.studentProfile = studentProfile;
      if (startDate) {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) studyRoutine.startDate = d;
      }
      if (durationDays && Number.isFinite(durationDays)) {
        studyRoutine.durationDays = durationDays;
      }
      // Auto-derive exam date if missing
      if (!studyRoutine.examInfo?.examDate && studyRoutine.startDate && studyRoutine.durationDays) {
        const examD = new Date(studyRoutine.startDate);
        examD.setUTCDate(examD.getUTCDate() + studyRoutine.durationDays);
        studyRoutine.examInfo = {
          ...(studyRoutine.examInfo || {}),
          examDate: examD
        };
      }
      await studyRoutine.save();
    } else {
      studyRoutine = await StudyRoutine.create({
        userId,
        routine: normalized,
        examInfo: examInfo || {},
        studentProfile: studentProfile || {},
        startDate: startDate ? new Date(startDate) : null,
        durationDays: durationDays && Number.isFinite(durationDays) ? durationDays : 30
      });
    }

    res.status(200).json({
      success: true,
      data: { routine: studyRoutine }
    });
  } catch (err) {
    next(err);
  }
};

exports.toggleSegment = async (req, res, next) => {
  try {
    const { dayId, segmentId, completed } = req.body;
    const userId = userIdFrom(req);

    const studyRoutine = await StudyRoutine.findOne({ userId });
    if (!studyRoutine) {
      return res.status(404).json({ success: false, message: 'Routine not found' });
    }

    const day = studyRoutine.routine.id(dayId);
    if (!day) {
      return res.status(404).json({ success: false, message: 'Day not found' });
    }

    const segment = day.segments.id(segmentId);
    if (!segment) {
      return res.status(404).json({ success: false, message: 'Segment not found' });
    }

    segment.completed = !!completed;
    await studyRoutine.save();

    res.status(200).json({
      success: true,
      data: { routine: studyRoutine }
    });
  } catch (err) {
    next(err);
  }
};

// Manual edit of a single segment's fields
exports.updateSegment = async (req, res, next) => {
  try {
    const { dayId, segmentId, fields } = req.body;
    const userId = userIdFrom(req);

    if (!fields || typeof fields !== 'object') {
      return res.status(400).json({ success: false, message: 'fields object is required' });
    }

    const studyRoutine = await StudyRoutine.findOne({ userId });
    if (!studyRoutine) {
      return res.status(404).json({ success: false, message: 'Routine not found' });
    }

    const day = studyRoutine.routine.id(dayId);
    if (!day) {
      return res.status(404).json({ success: false, message: 'Day not found' });
    }

    const segment = day.segments.id(segmentId);
    if (!segment) {
      return res.status(404).json({ success: false, message: 'Segment not found' });
    }

    // Update only allowed fields (backwards-compatible with old client)
    const allowed = ['time', 'subject', 'paper', 'chapter', 'task', 'startAt', 'endAt', 'priority', 'estimatedMinutes'];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        if ((key === 'startAt' || key === 'endAt') && fields[key]) {
          const d = new Date(fields[key]);
          segment[key] = isNaN(d.getTime()) ? null : d;
        } else {
          segment[key] = fields[key];
        }
      }
    }
    await studyRoutine.save();

    res.status(200).json({
      success: true,
      data: { routine: studyRoutine }
    });
  } catch (err) {
    next(err);
  }
};

// Replace entire routine (used after AI modification)
exports.replaceRoutine = async (req, res, next) => {
  try {
    const { routine, startDate, durationDays } = req.body;
    if (!routine || !Array.isArray(routine)) {
      return res.status(400).json({ success: false, message: 'Invalid routine format' });
    }
    const userId = userIdFrom(req);

    const studyRoutine = await StudyRoutine.findOne({ userId });
    if (!studyRoutine) {
      return res.status(404).json({ success: false, message: 'Routine not found' });
    }

    const normalized = backfillDates(normalizeRoutine(routine), {
      wakeUpHour: 7,
      defaultSegmentMinutes: 90
    });

    studyRoutine.routine = normalized;
    if (startDate) {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) studyRoutine.startDate = d;
    }
    if (durationDays && Number.isFinite(durationDays)) {
      studyRoutine.durationDays = durationDays;
    }
    await studyRoutine.save();

    res.status(200).json({
      success: true,
      data: { routine: studyRoutine }
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteRoutine = async (req, res, next) => {
  try {
    const userId = userIdFrom(req);
    await StudyRoutine.deleteOne({ userId });
    await StudySession.deleteMany({ userId });
    res.status(200).json({
      success: true,
      message: 'Routine deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /stats
 * Returns aggregate tracking stats: streak, completion %, per-subject %
 */
exports.getStats = async (req, res, next) => {
  try {
    const userId = userIdFrom(req);
    const studyRoutine = await StudyRoutine.findOne({ userId }).lean();
    if (!studyRoutine) {
      return res.status(200).json({
        success: true,
        data: {
          streakDays: 0,
          todayCompletionPct: 0,
          overallCompletionPct: 0,
          bySubject: {},
          byDay: []
        }
      });
    }

    const today = toISODate(new Date());
    const days = Array.isArray(studyRoutine.routine) ? studyRoutine.routine : [];
    let totalSegments = 0;
    let doneSegments = 0;
    let todayDone = 0;
    let todayTotal = 0;
    const bySubject = {};
    const byDay = [];

    // Streak: walk most-recent days (today and earlier) backwards.
    // A "streak day" is a day with at least 1 segment AND all segments completed.
    const dayByDate = new Map();
    for (const day of days) {
      const key = day.dayDate ? toISODate(day.dayDate) : null;
      if (!key) continue;
      dayByDate.set(key, day);
    }

    for (const day of days) {
      const segs = Array.isArray(day.segments) ? day.segments : [];
      let dDone = 0;
      for (const seg of segs) {
        totalSegments++;
        if (seg.completed) {
          doneSegments++;
          dDone++;
        }
        const subj = seg.subject || 'Other';
        if (!bySubject[subj]) bySubject[subj] = { planned: 0, done: 0, pct: 0 };
        bySubject[subj].planned++;
        if (seg.completed) bySubject[subj].done++;

        if (day.dayDate && toISODate(day.dayDate) === today) {
          todayTotal++;
          if (seg.completed) todayDone++;
        }
      }
      if (day.dayDate) {
        byDay.push({
          dayDate: toISODate(day.dayDate),
          day: day.day,
          planned: segs.length,
          done: dDone,
          pct: segs.length === 0 ? 0 : Math.round((dDone / segs.length) * 100)
        });
      }
    }

    for (const subj of Object.keys(bySubject)) {
      const s = bySubject[subj];
      s.pct = s.planned === 0 ? 0 : Math.round((s.done / s.planned) * 100);
    }

    // Streak: from today backward, while the day is fully complete
    let streakDays = 0;
    const cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const probe = new Date(cursor);
      probe.setUTCDate(cursor.getUTCDate() - i);
      const key = toISODate(probe);
      const day = dayByDate.get(key);
      if (!day) break; // past the routine horizon → stop
      const segs = Array.isArray(day.segments) ? day.segments : [];
      if (segs.length === 0) break;
      const allDone = segs.every((s) => s.completed);
      if (allDone) streakDays++;
      else break;
    }

    res.status(200).json({
      success: true,
      data: {
        streakDays,
        todayCompletionPct: todayTotal === 0 ? 0 : Math.round((todayDone / todayTotal) * 100),
        overallCompletionPct: totalSegments === 0 ? 0 : Math.round((doneSegments / totalSegments) * 100),
        bySubject,
        byDay
      }
    });
  } catch (err) {
    next(err);
  }
};

// --- Phase 2 focus-mode session scaffolding ---

exports.startSession = async (req, res, next) => {
  try {
    const { dayId, segmentId } = req.body;
    if (!dayId || !segmentId) {
      return res.status(400).json({ success: false, message: 'dayId and segmentId required' });
    }
    const userId = userIdFrom(req);
    const routine = await StudyRoutine.findOne({ userId });
    if (!routine) return res.status(404).json({ success: false, message: 'Routine not found' });

    const session = await StudySession.create({
      userId,
      routineId: routine._id,
      dayId,
      segmentId,
      startedAt: new Date()
    });
    res.status(200).json({ success: true, data: { session } });
  } catch (err) {
    next(err);
  }
};

exports.stopSession = async (req, res, next) => {
  try {
    const { sessionId, completed } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId required' });
    }
    const userId = userIdFrom(req);
    const session = await StudySession.findOne({ _id: sessionId, userId });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    session.endedAt = new Date();
    session.durationSeconds = Math.round((session.endedAt - session.startedAt) / 1000);
    session.completedDuringSession = !!completed;
    await session.save();
    res.status(200).json({ success: true, data: { session } });
  } catch (err) {
    next(err);
  }
};