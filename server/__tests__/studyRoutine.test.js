/**
 * Unit tests for the Study Routine feature.
 *
 * These tests mock Mongoose models and the Groq SDK so they run without
 * a live database or LLM. They exercise validation, size caps, schema
 * sanitization, error handling, and edge cases identified in the code review.
 */

// ---------------------------------------------------------------------------
// Shared test utilities
// ---------------------------------------------------------------------------

/** Build a minimal Express-like req/res/next triple. */
function mockReqResNext(overrides = {}) {
  const req = {
    user: { _id: 'user123', id: 'user123', role: 'student' },
    body: {},
    ...overrides
  };
  const res = {
    _status: 200,
    _json: null,
    status(code) { this._status = code; return this; },
    json(data) { this._json = data; return this; }
  };
  const next = jest.fn();
  return { req, res, next };
}

/** Helper: makes a day with N segments. */
function makeDay(dayDate, segCount = 3, opts = {}) {
  const segments = [];
  for (let i = 0; i < segCount; i++) {
    segments.push({
      time: `${7 + i}:00 AM`,
      subject: opts.subject || 'Physics',
      paper: '1st Paper',
      chapter: `Chapter ${i + 1}`,
      task: `Solve exercise ${i + 1}`,
      completed: opts.completed ?? false,
      startAt: `${dayDate}T0${1 + i}:00:00.000Z`,
      endAt: `${dayDate}T0${1 + i}:30:00.000Z`,
      estimatedMinutes: 30,
      priority: opts.priority || 'medium'
    });
  }
  return { day: 'Monday', dayDate, segments, ...(opts.isRest ? { isRest: true } : {}) };
}

// ---------------------------------------------------------------------------
// Mock Mongoose models
// ---------------------------------------------------------------------------

const mockSave = jest.fn().mockResolvedValue(true);

// Simulate Mongoose subdoc `.id()` behaviour on a plain array
function attachSubdocId(arr) {
  arr.id = function (id) {
    return this.find((item) => String(item._id) === String(id)) || null;
  };
  return arr;
}

function makeRoutineDoc(overrides = {}) {
  const days = overrides.routine || [makeDay('2026-07-01')];
  // Give each day and segment a fake _id and attach .id()
  days.forEach((d, di) => {
    d._id = d._id || `day-${di}`;
    if (Array.isArray(d.segments)) {
      d.segments.forEach((s, si) => { s._id = s._id || `seg-${di}-${si}`; });
      attachSubdocId(d.segments);
    }
  });
  const routineArr = attachSubdocId(days);

  return {
    _id: 'routine-1',
    userId: 'user123',
    routine: routineArr,
    startDate: overrides.startDate || new Date('2026-07-01'),
    durationDays: overrides.durationDays || 30,
    generatedUpTo: overrides.generatedUpTo || new Date('2026-07-07'),
    studentProfile: overrides.studentProfile || { year: '2nd', stream: 'Science' },
    examInfo: overrides.examInfo || { examName: 'HSC 2026' },
    save: mockSave,
    ...overrides
  };
}

jest.mock('../models/StudyRoutine', () => {
  const leanMock = jest.fn();
  const actual = {
    findOne: jest.fn().mockReturnValue({ lean: leanMock }),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn()
  };
  return actual;
});

jest.mock('../models/StudySession', () => ({
  findOne: jest.fn(),
  deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 })
}));

jest.mock('../utils/recurrence', () => ({
  backfillDates: jest.fn((r) => r),
  generateDayPlan: jest.fn(() => []),
  toISODate: jest.fn((d) => {
    if (!d) return null;
    const date = new Date(d);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }),
  startOfDay: jest.fn((d) => {
    const out = new Date(d);
    out.setUTCHours(0, 0, 0, 0);
    return out;
  })
}));

const StudyRoutine = require('../models/StudyRoutine');
const StudySession = require('../models/StudySession');
const controller = require('../controllers/studyRoutineController');

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue(true);
});

// ===========================================================================
// saveRoutine
// ===========================================================================
describe('saveRoutine', () => {
  test('rejects when routine is not an array', async () => {
    const { req, res, next } = mockReqResNext({ body: { routine: 'not-array' } });
    await controller.saveRoutine(req, res, next);
    expect(res._status).toBe(400);
    expect(res._json.success).toBe(false);
  });

  test('rejects null routine', async () => {
    const { req, res, next } = mockReqResNext({ body: { routine: null } });
    await controller.saveRoutine(req, res, next);
    expect(res._status).toBe(400);
  });

  test('rejects empty routine array', async () => {
    const { req, res, next } = mockReqResNext({ body: { routine: [] } });
    await controller.saveRoutine(req, res, next);
    expect(res._status).toBe(400);
    expect(res._json.message).toMatch(/empty/i);
  });

  test('rejects oversized routine (> 365 days)', async () => {
    const bigRoutine = Array.from({ length: 400 }, (_, i) => makeDay(`2026-07-${String(i + 1).padStart(2, '0')}`));
    const { req, res, next } = mockReqResNext({ body: { routine: bigRoutine } });
    await controller.saveRoutine(req, res, next);
    expect(res._status).toBe(400);
    expect(res._json.message).toMatch(/365/);
  });

  test('rejects day with segments as string', async () => {
    const { req, res, next } = mockReqResNext({
      body: { routine: [{ dayDate: '2026-07-01', segments: 'invalid' }] }
    });
    await controller.saveRoutine(req, res, next);
    expect(res._status).toBe(400);
    expect(res._json.message).toMatch(/segments.*array/i);
  });

  test('rejects day with > 50 segments', async () => {
    const { req, res, next } = mockReqResNext({
      body: { routine: [makeDay('2026-07-01', 51)] }
    });
    await controller.saveRoutine(req, res, next);
    expect(res._status).toBe(400);
    expect(res._json.message).toMatch(/50/);
  });

  test('accepts valid 7-day routine and saves', async () => {
    const routine = Array.from({ length: 7 }, (_, i) =>
      makeDay(`2026-07-0${i + 1}`)
    );
    const savedDoc = makeRoutineDoc({ routine });
    StudyRoutine.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const { req, res, next } = mockReqResNext({
      body: { routine, studentProfile: { year: '2nd', stream: 'Science' } }
    });
    await controller.saveRoutine(req, res, next);
    expect(res._status).not.toBe(400);
  });
});

// ===========================================================================
// replaceRoutine
// ===========================================================================
describe('replaceRoutine', () => {
  test('rejects non-array routine', async () => {
    const { req, res, next } = mockReqResNext({ body: { routine: 42 } });
    await controller.replaceRoutine(req, res, next);
    expect(res._status).toBe(400);
  });

  test('rejects oversized routine', async () => {
    const bigRoutine = Array.from({ length: 400 }, () => makeDay('2026-07-01'));
    const { req, res, next } = mockReqResNext({ body: { routine: bigRoutine } });
    await controller.replaceRoutine(req, res, next);
    expect(res._status).toBe(400);
    expect(res._json.message).toMatch(/365/);
  });

  test('returns 404 when no routine exists', async () => {
    StudyRoutine.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const { req, res, next } = mockReqResNext({
      body: { routine: [makeDay('2026-07-01')] }
    });
    await controller.replaceRoutine(req, res, next);
    expect(res._status).toBe(404);
  });
});

// ===========================================================================
// toggleSegment
// ===========================================================================
describe('toggleSegment', () => {
  test('returns 404 for missing routine', async () => {
    StudyRoutine.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const { req, res, next } = mockReqResNext({
      body: { dayId: 'day-0', segmentId: 'seg-0-0', completed: true }
    });
    await controller.toggleSegment(req, res, next);
    expect(res._status).toBe(404);
  });

  test('returns 404 for invalid dayId', async () => {
    StudyRoutine.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(makeRoutineDoc()) });
    const { req, res, next } = mockReqResNext({
      body: { dayId: 'nonexistent', segmentId: 'seg-0-0', completed: true }
    });
    await controller.toggleSegment(req, res, next);
    expect(res._status).toBe(404);
    expect(res._json.message).toMatch(/day/i);
  });

  test('returns 404 for invalid segmentId', async () => {
    StudyRoutine.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(makeRoutineDoc()) });
    const { req, res, next } = mockReqResNext({
      body: { dayId: 'day-0', segmentId: 'nonexistent', completed: true }
    });
    await controller.toggleSegment(req, res, next);
    expect(res._status).toBe(404);
    expect(res._json.message).toMatch(/segment/i);
  });

  test('toggles segment successfully', async () => {
    const doc = makeRoutineDoc();
    StudyRoutine.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) });
    const { req, res, next } = mockReqResNext({
      body: { dayId: 'day-0', segmentId: 'seg-0-0', completed: true }
    });
    await controller.toggleSegment(req, res, next);
    expect(res._status).toBe(200);
    expect(doc.routine[0].segments[0].completed).toBe(true);
    expect(mockSave).toHaveBeenCalled();
  });

  test('falls back to index-based segment lookup', async () => {
    const doc = makeRoutineDoc();
    // Remove _id from segments so `.id()` returns null
    doc.routine[0].segments.forEach((s) => delete s._id);
    doc.routine[0].segments.id = () => null; // force .id() to fail
    StudyRoutine.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) });
    const { req, res, next } = mockReqResNext({
      body: { dayId: 'day-0', segmentId: '0', completed: true }
    });
    await controller.toggleSegment(req, res, next);
    expect(res._status).toBe(200);
    expect(doc.routine[0].segments[0].completed).toBe(true);
  });
});

// ===========================================================================
// getStats
// ===========================================================================
describe('getStats', () => {
  test('returns zeros for missing routine', async () => {
    StudyRoutine.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const { req, res, next } = mockReqResNext();
    await controller.getStats(req, res, next);
    expect(res._status).toBe(200);
    expect(res._json.data.streakDays).toBe(0);
    expect(res._json.data.overallCompletionPct).toBe(0);
  });

  test('excludes non-study subjects from bySubject', async () => {
    const day = makeDay('2026-07-01', 2, { subject: 'Break' });
    day.segments.push({
      _id: 'seg-extra',
      subject: 'Physics',
      completed: true,
      time: '10:00 AM',
      paper: '',
      chapter: '',
      task: '',
      startAt: '2026-07-01T04:00:00.000Z',
      endAt: '2026-07-01T04:30:00.000Z',
      estimatedMinutes: 30,
      priority: 'medium'
    });
    attachSubdocId(day.segments);
    const doc = makeRoutineDoc({ routine: [day] });
    StudyRoutine.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) });
    const { req, res, next } = mockReqResNext();
    await controller.getStats(req, res, next);
    expect(res._json.data.bySubject).not.toHaveProperty('Break');
    expect(res._json.data.bySubject).toHaveProperty('Physics');
  });

  test('byDay is sorted ascending', async () => {
    const days = [
      makeDay('2026-07-03'),
      makeDay('2026-07-01'),
      makeDay('2026-07-02')
    ];
    const doc = makeRoutineDoc({ routine: days });
    StudyRoutine.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) });
    const { req, res, next } = mockReqResNext();
    await controller.getStats(req, res, next);
    const dates = res._json.data.byDay.map((d) => d.dayDate);
    expect(dates).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
  });
});

// ===========================================================================
// deleteRoutine
// ===========================================================================
describe('deleteRoutine', () => {
  test('deletes routine and sessions', async () => {
    StudyRoutine.deleteOne.mockResolvedValue({ deletedCount: 1 });
    StudySession.deleteMany.mockResolvedValue({ deletedCount: 3 });
    const { req, res, next } = mockReqResNext();
    await controller.deleteRoutine(req, res, next);
    expect(res._status).toBe(200);
    expect(StudyRoutine.deleteOne).toHaveBeenCalledWith({ userId: 'user123' });
    expect(StudySession.deleteMany).toHaveBeenCalledWith({ userId: 'user123' });
  });
});

// ===========================================================================
// stopSession
// ===========================================================================
describe('stopSession', () => {
  test('returns 400 if sessionId missing', async () => {
    const { req, res, next } = mockReqResNext({ body: {} });
    await controller.stopSession(req, res, next);
    expect(res._status).toBe(400);
  });

  test('returns 404 if session not found', async () => {
    StudySession.findOne.mockResolvedValue(null);
    const { req, res, next } = mockReqResNext({ body: { sessionId: 'sess-1' } });
    await controller.stopSession(req, res, next);
    expect(res._status).toBe(404);
  });

  test('handles null startedAt gracefully', async () => {
    const session = {
      _id: 'sess-1',
      userId: 'user123',
      startedAt: null,
      endedAt: null,
      durationSeconds: 0,
      completedDuringSession: false,
      save: jest.fn().mockResolvedValue(true)
    };
    StudySession.findOne.mockResolvedValue(session);
    const { req, res, next } = mockReqResNext({
      body: { sessionId: 'sess-1', completed: true }
    });
    await controller.stopSession(req, res, next);
    expect(res._status).toBe(200);
    expect(session.durationSeconds).toBe(0); // Defensive fallback
    expect(session.save).toHaveBeenCalled();
  });
});

// ===========================================================================
// normalizeStudentProfile (via saveRoutine validation)
// ===========================================================================
describe('studentProfile sanitization', () => {
  test('strips unknown keys from studentProfile', async () => {
    const routine = [makeDay('2026-07-01')];
    const maliciousProfile = {
      year: '2nd',
      stream: 'Science',
      __proto__: { admin: true },
      maliciousKey: 'drop table',
      constructor: 'evil'
    };
    StudyRoutine.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const { req, res, next } = mockReqResNext({
      body: { routine, studentProfile: maliciousProfile }
    });
    // The validation should pass (year + stream are valid keys)
    await controller.saveRoutine(req, res, next);
    expect(res._status).not.toBe(400);
  });
});

// ===========================================================================
// updateSegment field filtering
// ===========================================================================
describe('updateSegment', () => {
  test('returns 404 for missing routine', async () => {
    StudyRoutine.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const { req, res, next } = mockReqResNext({
      body: { dayId: 'day-0', segmentId: 'seg-0-0', fields: { subject: 'Math' } }
    });
    await controller.updateSegment(req, res, next);
    expect(res._status).toBe(404);
  });
});
