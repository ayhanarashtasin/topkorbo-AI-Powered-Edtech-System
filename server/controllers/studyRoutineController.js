const StudyRoutine = require('../models/StudyRoutine');
const StudySession = require('../models/StudySession');
const { backfillDates, generateDayPlan, toISODate, startOfDay } = require('../utils/recurrence');

const MAX_ROUTINE_DAYS = 365;
const MAX_SEGMENTS_PER_DAY = 50;

const NON_STUDY_SUBJECTS = new Set(['Break', 'College', 'Morning Routine', 'Rest']);

function userIdFrom(req) {
  return req.user._id || req.user.id;
}

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
    } else {
      out.segments = [];
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

function normalizeStudentProfile(profile) {
  if (!profile || typeof profile !== 'object') return {};
  const ALLOWED_KEYS = new Set([
    'year', 'stream', 'unavailableHours', 'wakeUpTime', 'sleepTime',
    'weakSubjects', 'targetGpa', 'dailyStudyHours',
    'planDurationDays', 'plan_duration_days',
    'studyDaysPerWeek', 'study_days_per_week',
    'startDate'
  ]);
  const out = {};
  for (const key of Object.keys(profile)) {
    if (ALLOWED_KEYS.has(key)) out[key] = profile[key];
  }
  if (out.planDurationDays === undefined && out.plan_duration_days !== undefined) {
    out.planDurationDays = out.plan_duration_days;
  }
  if (out.studyDaysPerWeek === undefined && out.study_days_per_week !== undefined) {
    out.studyDaysPerWeek = out.study_days_per_week;
  }
  return out;
}

function ensureFullRoutine(routine, { startDate, durationDays, studyDaysPerWeek } = {}) {
  const planDurationDays = Number.isFinite(durationDays) ? durationDays : 30;
  const perWeek = Math.min(7, Math.max(1, Number(studyDaysPerWeek) || 7));

  let resolvedStartDate = startDate;
  if (!resolvedStartDate && routine.length > 0 && routine[0].dayDate) {
    resolvedStartDate = toISODate(routine[0].dayDate);
  }

  const skeleton = generateDayPlan({
    startDate: resolvedStartDate || new Date(),
    durationDays: planDurationDays,
    studyDaysPerWeek: perWeek
  });
  if (skeleton.length === 0) return routine;

  const aiByDate = {};
  for (const day of routine) {
    const key = day.dayDate ? toISODate(day.dayDate) : null;
    if (key) aiByDate[key] = day;
  }

  return skeleton.map((sk) => {
    const aiDay = aiByDate[sk.dayDate];
    const hasAiSegments = aiDay && Array.isArray(aiDay.segments) && aiDay.segments.length > 0;

    if (hasAiSegments) {
      return {
        ...aiDay,
        day: aiDay.day || sk.day,
        dayDate: sk.dayDate + 'T00:00:00.000Z',
        isRest: false
      };
    }
    return {
      day: sk.day,
      dayDate: sk.dayDate + 'T00:00:00.000Z',
      segments: [],
      isRest: sk.isRest
    };
  });
}

function fillEmptyStudyDays(routine, examInfo, cutoffKey = null) {
  if (!Array.isArray(routine)) return routine;

  const subjects = examInfo?.subjects || [];
  const chapterList = [];
  for (const subj of subjects) {
    const name = subj.name || 'Study';
    const paper = subj.paper || '';
    const chapters = Array.isArray(subj.chapters) && subj.chapters.length > 0
      ? subj.chapters
      : [''];
    for (const chapter of chapters) {
      chapterList.push({
        subject: name,
        paper,
        chapter,
        task: chapter
          ? `Study and practice ${name} — ${chapter}`
          : `Review and practice ${name}`
      });
    }
  }

  const fallbackSegments = [
    { subject: 'Morning Routine', paper: '', chapter: '', task: 'Wake up, freshen up', priority: 'low', estimatedMinutes: 30 },
    { subject: 'Study', paper: '', chapter: '', task: 'Review notes and practice problems', priority: 'medium', estimatedMinutes: 90 },
    { subject: 'Break', paper: '', chapter: '', task: 'Short rest, snack', priority: 'low', estimatedMinutes: 15 },
    { subject: 'Study', paper: '', chapter: '', task: 'Continue practice and revision', priority: 'medium', estimatedMinutes: 90 },
    { subject: 'Break', paper: '', chapter: '', task: 'Rest, recharge', priority: 'low', estimatedMinutes: 15 },
    { subject: 'Study', paper: '', chapter: '', task: 'Review weak areas', priority: 'medium', estimatedMinutes: 90 },
    { subject: 'Study', paper: '', chapter: '', task: 'Solve previous questions', priority: 'medium', estimatedMinutes: 90 }
  ];

  let chIdx = 0;
  return routine.map((day) => {
    if (day.isRest) return day;
    const segs = Array.isArray(day.segments) ? day.segments : [];
    if (segs.length > 0) return day;

    if (cutoffKey) {
      const key = day.dayDate ? toISODate(day.dayDate) : null;
      if (key && key > cutoffKey) return day;
    }

    const newSegs = [];
    newSegs.push({
      subject: 'Morning Routine',
      paper: '',
      chapter: '',
      task: 'Wake up, freshen up',
      priority: 'low',
      estimatedMinutes: 30
    });

    if (chapterList.length > 0) {
      for (let block = 0; block < 6; block++) {
        const item = chapterList[chIdx % chapterList.length];
        chIdx++;
        newSegs.push({
          subject: item.subject,
          paper: item.paper,
          chapter: item.chapter,
          task: item.task,
          priority: 'medium',
          estimatedMinutes: 90
        });
        if (block < 5 && (block + 1) % 2 === 0) {
          newSegs.push({
            subject: 'Break',
            paper: '',
            chapter: '',
            task: 'Short rest, recharge',
            priority: 'low',
            estimatedMinutes: 15
          });
        }
      }
    } else {
      newSegs.push(...fallbackSegments.map((s) => ({ ...s })));
    }

    return { ...day, segments: newSegs };
  });
}

exports.saveRoutine = async (req, res, next) => {
  try {
    const { routine, examInfo, studentProfile, startDate, durationDays } = req.body;
    if (!routine || !Array.isArray(routine)) {
      return res.status(400).json({ success: false, message: 'Invalid routine format' });
    }
    if (routine.length === 0) {
      return res.status(400).json({ success: false, message: 'Routine cannot be empty' });
    }
    if (routine.length > MAX_ROUTINE_DAYS) {
      return res.status(400).json({ success: false, message: `Routine exceeds maximum of ${MAX_ROUTINE_DAYS} days` });
    }
    for (const day of routine) {
      if (day.segments && !Array.isArray(day.segments)) {
        return res.status(400).json({ success: false, message: 'Each day\'s segments must be an array' });
      }
      if (Array.isArray(day.segments) && day.segments.length > MAX_SEGMENTS_PER_DAY) {
        return res.status(400).json({ success: false, message: `Day has more than ${MAX_SEGMENTS_PER_DAY} segments` });
      }
    }
    const userId = userIdFrom(req);
    const normalizedProfile = normalizeStudentProfile(studentProfile);

    const fullRoutine = ensureFullRoutine(routine, {
      startDate,
      durationDays: durationDays || normalizedProfile.planDurationDays,
      studyDaysPerWeek: normalizedProfile.studyDaysPerWeek
    });

    const resolvedStart = startDate
      ? new Date(startDate)
      : (fullRoutine[0]?.dayDate ? new Date(fullRoutine[0].dayDate) : null);
    const resolvedDuration =
      durationDays && Number.isFinite(durationDays)
        ? durationDays
        : (normalizedProfile?.planDurationDays || 30);
    let planEnd = null;
    if (resolvedStart && !isNaN(resolvedStart.getTime())) {
      planEnd = new Date(resolvedStart);
      planEnd.setUTCDate(planEnd.getUTCDate() + resolvedDuration - 1);
    }

    let firstWeekEnd = null;
    if (resolvedStart && !isNaN(resolvedStart.getTime())) {
      firstWeekEnd = new Date(resolvedStart);
      firstWeekEnd.setUTCDate(firstWeekEnd.getUTCDate() + 6);
      if (planEnd && firstWeekEnd > planEnd) firstWeekEnd = new Date(planEnd);
    }
    const firstWeekKey = firstWeekEnd ? toISODate(firstWeekEnd) : null;

    const filled = fillEmptyStudyDays(fullRoutine, examInfo, firstWeekKey);
    const normalized = backfillDates(normalizeRoutine(filled), {
      wakeUpHour: 7,
      defaultSegmentMinutes: 90,
      timezoneOffsetHours: 6
    });

    let studyRoutine = await StudyRoutine.findOne({ userId });
    if (studyRoutine) {
      studyRoutine.routine = normalized;
      if (examInfo) studyRoutine.examInfo = examInfo;
      if (normalizedProfile) studyRoutine.studentProfile = normalizedProfile;
      if (resolvedStart && !isNaN(resolvedStart.getTime())) {
        studyRoutine.startDate = resolvedStart;
      }
      if (durationDays && Number.isFinite(durationDays)) {
        studyRoutine.durationDays = durationDays;
      }
      if (!studyRoutine.examInfo?.examDate && studyRoutine.startDate && studyRoutine.durationDays) {
        const examD = new Date(studyRoutine.startDate);
        examD.setUTCDate(examD.getUTCDate() + studyRoutine.durationDays);
        studyRoutine.examInfo = {
          ...(studyRoutine.examInfo || {}),
          examDate: examD,
          examName: studyRoutine.examInfo?.examName || 'Auto-derived'
        };
      }
      if (firstWeekEnd) studyRoutine.generatedUpTo = firstWeekEnd;
      await studyRoutine.save();
    } else {
      studyRoutine = await StudyRoutine.create({
        userId,
        routine: normalized,
        examInfo: examInfo || {},
        studentProfile: normalizedProfile || {},
        startDate: resolvedStart && !isNaN(resolvedStart.getTime()) ? resolvedStart : null,
        durationDays: resolvedDuration,
        generatedUpTo: firstWeekEnd
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

    let segment = day.segments.id(segmentId);
    if (!segment) {
      const idx = Number(segmentId);
      if (Number.isFinite(idx) && idx >= 0 && idx < day.segments.length) {
        segment = day.segments[idx];
      }
    }
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

exports.replaceRoutine = async (req, res, next) => {
  try {
    const { routine, startDate, durationDays } = req.body;
    if (!routine || !Array.isArray(routine)) {
      return res.status(400).json({ success: false, message: 'Invalid routine format' });
    }
    if (routine.length > MAX_ROUTINE_DAYS) {
      return res.status(400).json({ success: false, message: `Routine exceeds maximum of ${MAX_ROUTINE_DAYS} days` });
    }
    const userId = userIdFrom(req);

    const studyRoutine = await StudyRoutine.findOne({ userId });
    if (!studyRoutine) {
      return res.status(404).json({ success: false, message: 'Routine not found' });
    }

    const existingProfile = normalizeStudentProfile(studyRoutine.studentProfile);
    const fullRoutine = ensureFullRoutine(routine, {
      startDate: startDate || studyRoutine.startDate,
      durationDays: durationDays || studyRoutine.durationDays,
      studyDaysPerWeek: existingProfile.studyDaysPerWeek
    });

    const cutoffKey = studyRoutine.generatedUpTo ? toISODate(studyRoutine.generatedUpTo) : null;
    const filled = fillEmptyStudyDays(fullRoutine, studyRoutine.examInfo || {}, cutoffKey);
    const normalized = backfillDates(normalizeRoutine(filled), {
      wakeUpHour: 7,
      defaultSegmentMinutes: 90,
      timezoneOffsetHours: 6
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
        if (!NON_STUDY_SUBJECTS.has(subj)) {
          if (!bySubject[subj]) bySubject[subj] = { planned: 0, done: 0, pct: 0 };
          bySubject[subj].planned++;
          if (seg.completed) bySubject[subj].done++;
        }

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

    let streakDays = 0;
    const cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const probe = new Date(cursor);
      probe.setUTCDate(cursor.getUTCDate() - i);
      const key = toISODate(probe);
      const day = dayByDate.get(key);
      if (!day) break;
      const segs = Array.isArray(day.segments) ? day.segments : [];
      const studySegs = segs.filter((s) => !NON_STUDY_SUBJECTS.has(s.subject));
      if (studySegs.length === 0) continue;
      const allDone = studySegs.every((s) => s.completed);
      if (allDone) streakDays++;
      else break;
    }

    byDay.sort((a, b) => (a.dayDate || '').localeCompare(b.dayDate || ''));

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
    session.durationSeconds = (session.endedAt && session.startedAt)
      ? Math.round((session.endedAt - session.startedAt) / 1000)
      : 0;
    session.completedDuringSession = !!completed;
    await session.save();
    res.status(200).json({ success: true, data: { session } });
  } catch (err) {
    next(err);
  }
};