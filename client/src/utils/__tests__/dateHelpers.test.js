import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  toISODate,
  todayKey,
  isToday,
  isPast,
  isFuture,
  formatDayLong,
  formatDayShort,
  formatTime,
  eventsFromRoutine,
  findToday,
  findDayByKey,
  hasMoreWeeksToGenerate,
  calculateDaysUntilExam,
  formatRemainingTimeline
} from '../dateHelpers';

describe('toISODate', () => {
  it('returns null for null/undefined', () => {
    expect(toISODate(null)).toBeNull();
    expect(toISODate(undefined)).toBeNull();
  });

  it('returns first 10 chars of an ISO string', () => {
    expect(toISODate('2024-09-16')).toBe('2024-09-16');
    expect(toISODate('2024-09-16T00:00:00.000Z')).toBe('2024-09-16');
  });

  it('returns null for invalid string', () => {
    expect(toISODate('not-a-date')).toBeNull();
  });

  it('converts Date object to YYYY-MM-DD using UTC', () => {
    const d = new Date('2024-09-16T00:00:00.000Z');
    expect(toISODate(d)).toBe('2024-09-16');
  });

  it('handles midnight boundary in UTC', () => {
    const d = new Date('2024-09-16T23:00:00.000Z');
    expect(toISODate(d)).toBe('2024-09-16');
  });

  it('handles date near month boundary', () => {
    const d = new Date('2024-02-29T00:00:00.000Z');
    expect(toISODate(d)).toBe('2024-02-29');
  });
});

describe('todayKey', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns today as YYYY-MM-DD', () => {
    vi.setSystemTime(new Date('2024-09-16T10:00:00.000Z'));
    expect(todayKey()).toBe('2024-09-16');
  });
});

describe('isToday / isPast / isFuture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-09-16T10:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('isToday returns true for today', () => {
    expect(isToday('2024-09-16')).toBe(true);
    expect(isToday('2024-09-15')).toBe(false);
  });

  it('isPast returns true for older dates', () => {
    expect(isPast('2024-09-15')).toBe(true);
    expect(isPast('2024-09-16')).toBe(false);
    expect(isPast('2024-09-17')).toBe(false);
  });

  it('isFuture returns true for later dates', () => {
    expect(isFuture('2024-09-17')).toBe(true);
    expect(isFuture('2024-09-16')).toBe(false);
    expect(isFuture('2024-09-15')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isToday(null)).toBe(false);
    expect(isPast(null)).toBe(false);
    expect(isFuture(null)).toBe(false);
  });
});

describe('formatDayLong', () => {
  it('returns empty string for null', () => {
    expect(formatDayLong(null)).toBe('');
  });

  it('formats a date string', () => {
    const result = formatDayLong('2024-09-16');
    expect(result).toContain('September');
    expect(result).toContain('16');
  });

  it('formats a Date object', () => {
    const result = formatDayLong(new Date('2024-09-16T00:00:00.000Z'));
    expect(result).toContain('September');
  });
});

describe('formatDayShort', () => {
  it('returns empty string for null', () => {
    expect(formatDayShort(null)).toBe('');
  });

  it('formats a short date label', () => {
    const result = formatDayShort('2024-09-16');
    expect(result).toContain('Sep');
  });
});

describe('formatTime', () => {
  it('returns empty string for null', () => {
    expect(formatTime(null)).toBe('');
  });

  it('returns 24h formatted time', () => {
    const result = formatTime('2024-09-16T07:30:00.000Z');
    expect(result).toBeTruthy();
  });
});

describe('eventsFromRoutine', () => {
  it('returns empty array for null routine', () => {
    expect(eventsFromRoutine(null)).toEqual([]);
  });

  it('returns empty array for routine with no days', () => {
    expect(eventsFromRoutine({ routine: [] })).toEqual([]);
  });

  it('creates events from segments with startAt/endAt', () => {
    const routine = {
      routine: [
        {
          _id: 'day1',
          dayDate: '2024-09-16T00:00:00.000Z',
          segments: [
            {
              _id: 'seg1',
              subject: 'Physics',
              startAt: '2024-09-16T01:00:00.000Z',
              endAt: '2024-09-16T02:30:00.000Z',
              completed: false,
              priority: 'medium',
              time: '7:00 AM'
            }
          ]
        }
      ]
    };
    const events = eventsFromRoutine(routine);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Physics');
    expect(events[0].resource.dayId).toBe('day1');
    expect(events[0].resource.completed).toBe(false);
  });

  it('skips segments without valid startAt/endAt', () => {
    const routine = {
      routine: [
        {
          _id: 'day1',
          dayDate: '2024-09-16T00:00:00.000Z',
          segments: [
            { _id: 'seg1', subject: 'Physics', startAt: null, endAt: null }
          ]
        }
      ]
    };
    const events = eventsFromRoutine(routine);
    expect(events).toHaveLength(0);
  });

  it('marks dayCompleted when all segments done', () => {
    const routine = {
      routine: [
        {
          _id: 'day1',
          dayDate: '2024-09-16T00:00:00.000Z',
          segments: [
            {
              _id: 'seg1',
              subject: 'Physics',
              startAt: '2024-09-16T01:00:00.000Z',
              endAt: '2024-09-16T02:30:00.000Z',
              completed: true,
              priority: 'medium',
              time: '7:00 AM'
            }
          ]
        }
      ]
    };
    const events = eventsFromRoutine(routine);
    expect(events[0].resource.dayCompleted).toBe(true);
  });

  it('creates events across a 30-day routine spanning multiple months', () => {
    const days = [];
    const start = new Date('2026-06-28T00:00:00.000Z');
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const dayDate = d.toISOString();
      // Add 2 segments for each day (rest days = no segments)
      const segments = (i % 7 < 6)
        ? [
            {
              _id: `seg${i}_1`,
              subject: 'Physics',
              startAt: new Date(d.getTime() + 1 * 3600000).toISOString(),
              endAt: new Date(d.getTime() + 2.5 * 3600000).toISOString(),
              completed: false,
              priority: 'medium',
              time: '7:00 AM'
            },
            {
              _id: `seg${i}_2`,
              subject: 'Chemistry',
              startAt: new Date(d.getTime() + 3 * 3600000).toISOString(),
              endAt: new Date(d.getTime() + 4.5 * 3600000).toISOString(),
              completed: false,
              priority: 'medium',
              time: '9:00 AM'
            }
          ]
        : [];
      days.push({ _id: `day${i}`, dayDate, segments });
    }
    const routine = { routine: days };
    const events = eventsFromRoutine(routine);
    // ~26 study days * 2 segments each = ~52 events (June 28 has 4 rest days spread across 30 days)
    expect(events.length).toBeGreaterThanOrEqual(48);
    // Events exist after July 1
    const afterJuly1 = events.filter((e) => e.start >= new Date('2026-07-01T00:00:00.000Z'));
    expect(afterJuly1.length).toBeGreaterThan(0);
    // Events exist all the way to the end
    const lastEventDate = events[events.length - 1].start;
    expect(lastEventDate >= new Date('2026-07-25T00:00:00.000Z')).toBe(true);
  });

  it('skips rest days (empty segments) without creating events', () => {
    const days = [
      {
        _id: 'day1',
        dayDate: '2026-06-28T00:00:00.000Z',
        segments: [
          {
            _id: 'seg1',
            subject: 'Physics',
            startAt: '2026-06-28T01:00:00.000Z',
            endAt: '2026-06-28T02:30:00.000Z',
            completed: false,
            priority: 'medium',
            time: '7:00 AM'
          }
        ]
      },
      {
        _id: 'day2',
        dayDate: '2026-06-29T00:00:00.000Z',
        segments: [] // rest day
      },
      {
        _id: 'day3',
        dayDate: '2026-06-30T00:00:00.000Z',
        segments: [
          {
            _id: 'seg2',
            subject: 'Chemistry',
            startAt: '2026-06-30T01:00:00.000Z',
            endAt: '2026-06-30T02:30:00.000Z',
            completed: false,
            priority: 'medium',
            time: '7:00 AM'
          }
        ]
      }
    ];
    const events = eventsFromRoutine({ routine: days });
    expect(events).toHaveLength(2);
    expect(events[0].resource.dayId).toBe('day1');
    expect(events[1].resource.dayId).toBe('day3');
  });

  it('creates events across a full 35-day routine starting 2026-07-27', () => {
    const days = [];
    const start = new Date('2026-07-27T00:00:00.000Z');
    for (let i = 0; i < 35; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const daySegments = [];
      // 8 segments per day (morning routine + 6 study blocks + breaks)
      for (let s = 0; s < 8; s++) {
        const segStart = new Date(d.getTime() + (s * 90 + 30) * 60000);
        daySegments.push({
          _id: `seg${i}_${s}`,
          subject: s === 0 ? 'Morning Routine' : (s % 2 === 0 ? 'Break' : 'Physics'),
          startAt: segStart.toISOString(),
          endAt: new Date(segStart.getTime() + 90 * 60000).toISOString(),
          completed: false,
          priority: 'medium',
          time: ''
        });
      }
      days.push({ _id: `day${i}`, dayDate: d.toISOString(), segments: daySegments });
    }
    const events = eventsFromRoutine({ routine: days });
    expect(events.length).toBeGreaterThan(200); // ~8 * 35 = 280, minus some for breaks without valid times
    const lastDate = events[events.length - 1].start;
    expect(lastDate >= new Date('2026-08-28T00:00:00.000Z')).toBe(true);
    // Friday Jul 31 has events
    const jul31 = events.filter((e) => {
      const d = new Date(e.start);
      return d.getUTCFullYear() === 2026 && d.getUTCMonth() === 6 && d.getUTCDate() === 31;
    });
    expect(jul31.length).toBeGreaterThan(0);
    // Events exist after Jul 31
    const afterJul31 = events.filter((e) => e.start > new Date('2026-07-31T23:59:59.000Z'));
    expect(afterJul31.length).toBeGreaterThan(0);
  });

  it('does not create events for rest days in a 6-day-per-week plan', () => {
    const start = new Date('2026-07-27T00:00:00.000Z');
    const startWeekday = start.getUTCDay(); // Monday = 1
    // 6 days/week = 1 rest day/week. restDayIndexes = [0] (Sunday)
    const days = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const weekdayIdx = (startWeekday + i) % 7;
      const isRest = weekdayIdx === 0; // Sunday = rest
      if (isRest) {
        days.push({ _id: `day${i}`, dayDate: d.toISOString(), segments: [] });
      } else {
        days.push({
          _id: `day${i}`,
          dayDate: d.toISOString(),
          segments: [{
            _id: `seg${i}`,
            subject: 'Physics',
            startAt: d.toISOString(),
            endAt: new Date(d.getTime() + 90 * 60000).toISOString(),
            completed: false,
            priority: 'medium',
            time: ''
          }]
        });
      }
    }
    const events = eventsFromRoutine({ routine: days });
    // 35 days - 5 Sundays = 30 study days with 1 segment each
    expect(events).toHaveLength(30);
    // No events on Sundays (Aug 2, 9, 16, 23, 30)
    const sundayEvents = events.filter((e) => {
      const day = new Date(e.start).getUTCDay();
      return day === 0;
    });
    expect(sundayEvents).toHaveLength(0);
  });
});

describe('findToday', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-09-16T10:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for null routine', () => {
    expect(findToday(null)).toBeNull();
  });

  it('finds the day matching today', () => {
    const routine = {
      routine: [
        { _id: 'd1', dayDate: '2024-09-15T00:00:00.000Z' },
        { _id: 'd2', dayDate: '2024-09-16T00:00:00.000Z' },
        { _id: 'd3', dayDate: '2024-09-17T00:00:00.000Z' }
      ]
    };
    const result = findToday(routine);
    expect(result._id).toBe('d2');
  });

  it('returns null when today is not in routine', () => {
    const routine = {
      routine: [
        { _id: 'd1', dayDate: '2024-09-10T00:00:00.000Z' }
      ]
    };
    expect(findToday(routine)).toBeNull();
  });
});

describe('findDayByKey', () => {
  it('returns null for null routine', () => {
    expect(findDayByKey(null, '2024-09-16')).toBeNull();
  });

  it('finds the day matching the key', () => {
    const routine = {
      routine: [
        { _id: 'd1', dayDate: '2024-09-15T00:00:00.000Z' },
        { _id: 'd2', dayDate: '2024-09-16T00:00:00.000Z' }
      ]
    };
    expect(findDayByKey(routine, '2024-09-16')._id).toBe('d2');
    expect(findDayByKey(routine, '2024-09-99')).toBeNull();
  });

  it('finds rest days (days with empty segments array)', () => {
    const routine = {
      routine: [
        { _id: 'd1', dayDate: '2026-06-28T00:00:00.000Z', segments: [{ _id: 's1', subject: 'Physics' }] },
        { _id: 'd2', dayDate: '2026-06-29T00:00:00.000Z', segments: [] },
        { _id: 'd3', dayDate: '2026-06-30T00:00:00.000Z', segments: [{ _id: 's2', subject: 'Chemistry' }] }
      ]
    };
    const restDay = findDayByKey(routine, '2026-06-29');
    expect(restDay).not.toBeNull();
    expect(restDay._id).toBe('d2');
    expect(Array.isArray(restDay.segments)).toBe(true);
    expect(restDay.segments).toHaveLength(0);
  });

  it('returns null for a valid key not in the routine', () => {
    const routine = {
      routine: [
        { _id: 'd1', dayDate: '2026-06-28T00:00:00.000Z' }
      ]
    };
    expect(findDayByKey(routine, '2026-06-29')).toBeNull();
  });

  it('finds any day in a 30-day routine', () => {
    const days = [];
    const start = new Date('2026-06-28T00:00:00.000Z');
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      days.push({ _id: `day${i}`, dayDate: d.toISOString(), segments: [] });
    }
    const routine = { routine: days };
    expect(findDayByKey(routine, '2026-06-28')._id).toBe('day0');
    expect(findDayByKey(routine, '2026-07-01')._id).toBe('day3');
    expect(findDayByKey(routine, '2026-07-02')._id).toBe('day4');
    expect(findDayByKey(routine, '2026-07-27')._id).toBe('day29');
    expect(findDayByKey(routine, '2026-07-28')).toBeNull();
  });

  it('finds any day in a 35-day routine starting 2026-07-27', () => {
    const days = [];
    const start = new Date('2026-07-27T00:00:00.000Z');
    for (let i = 0; i < 35; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      days.push({ _id: `day${i}`, dayDate: d.toISOString(), segments: [] });
    }
    const routine = { routine: days };
    expect(findDayByKey(routine, '2026-07-27')._id).toBe('day0');
    expect(findDayByKey(routine, '2026-07-31')._id).toBe('day4');
    expect(findDayByKey(routine, '2026-08-15')._id).toBe('day19');
    expect(findDayByKey(routine, '2026-08-30')._id).toBe('day34');
    expect(findDayByKey(routine, '2026-08-31')).toBeNull();
  });
});

describe('hasMoreWeeksToGenerate', () => {
  // Helper to build a 30-day routine starting at `start`, with a `segments`
  // array of `segs(dayIdx)` for each day.
  function makeRoutine({ start, durationDays = 30, generatedUpTo, segsForDay = () => [{ _id: 's' }] }) {
    const startDate = new Date(start);
    const days = [];
    for (let i = 0; i < durationDays; i++) {
      const d = new Date(startDate);
      d.setUTCDate(startDate.getUTCDate() + i);
      days.push({ _id: `day${i}`, dayDate: d.toISOString(), segments: segsForDay(i) });
    }
    const planEnd = new Date(startDate);
    planEnd.setUTCDate(planEnd.getUTCDate() + durationDays - 1);
    return {
      startDate: startDate.toISOString(),
      durationDays,
      generatedUpTo: generatedUpTo ? new Date(generatedUpTo).toISOString() : null,
      routine: days,
      // The planEnd is implicit; we don't include it on the doc — the helper
      // computes it from startDate + durationDays - 1.
      _planEnd: planEnd.toISOString().slice(0, 10)
    };
  }

  it('returns false for null/undefined routine', () => {
    expect(hasMoreWeeksToGenerate(null)).toBe(false);
    expect(hasMoreWeeksToGenerate(undefined)).toBe(false);
  });

  it('returns false when startDate is missing', () => {
    expect(hasMoreWeeksToGenerate({ durationDays: 30, generatedUpTo: null })).toBe(false);
  });

  it('returns false when durationDays is missing', () => {
    expect(hasMoreWeeksToGenerate({ startDate: '2026-06-27', generatedUpTo: null })).toBe(false);
  });

  it('returns false when generatedUpTo is null (never generated)', () => {
    const routine = makeRoutine({ start: '2026-06-27', durationDays: 30, generatedUpTo: null });
    expect(hasMoreWeeksToGenerate(routine)).toBe(false);
  });

  it('returns false when generatedUpTo equals planEnd (full plan)', () => {
    const routine = makeRoutine({ start: '2026-06-27', durationDays: 30 });
    // generatedUpTo is the last day, equals planEnd
    routine.generatedUpTo = routine._planEnd + 'T00:00:00.000Z';
    expect(hasMoreWeeksToGenerate(routine)).toBe(false);
  });

  it('returns false when generatedUpTo > planEnd', () => {
    const routine = makeRoutine({ start: '2026-06-27', durationDays: 30 });
    routine.generatedUpTo = '2026-08-15T00:00:00.000Z'; // past planEnd
    expect(hasMoreWeeksToGenerate(routine)).toBe(false);
  });

  // The key regression test: 6-days/week plan starting on a Saturday where
  // day 29 is a rest day. generatedUpTo would be set to day 28 (or the last
  // day with segments). For a fully-generated plan, generatedUpTo MUST equal
  // planEnd so the button stays hidden.
  it('returns false when the only "missing" days are rest days past planEnd', () => {
    const routine = makeRoutine({
      start: '2026-06-27', // Saturday
      durationDays: 30,
      // generatedUpTo = planEnd (after the server-side fix)
      generatedUpTo: '2026-07-26'
    });
    // Make day 30 (i=29, a Sunday/rest day) empty to simulate the rest day
    routine.routine[29].segments = [];
    expect(hasMoreWeeksToGenerate(routine)).toBe(false);
  });

  it('returns true when generatedUpTo is before planEnd AND there are empty days after', () => {
    // Simulate a partial generation: only first 7 days have segments,
    // generatedUpTo = day 7.
    const routine = makeRoutine({
      start: '2026-06-27',
      durationDays: 30,
      generatedUpTo: '2026-07-03', // day 7
      segsForDay: (i) => (i <= 6 ? [{ _id: `s${i}` }] : [])
    });
    expect(hasMoreWeeksToGenerate(routine)).toBe(true);
  });

  it('returns true based on dates even when later placeholder rows are absent', () => {
    // Regression: the saved routine only contains the generated first week —
    // there are NO day rows past generatedUpTo. The button must still appear
    // because, by date, the plan has more weeks left (generateNextWeek creates
    // the missing rows on demand).
    const routine = makeRoutine({
      start: '2026-06-27',
      durationDays: 30,
      generatedUpTo: '2026-07-03',
      segsForDay: () => [{ _id: 's' }]
    });
    // Drop every day past the first week to simulate non-materialized rows.
    routine.routine = routine.routine.slice(0, 7);
    expect(hasMoreWeeksToGenerate(routine)).toBe(true);
  });

  it('returns true when generatedUpTo is before planEnd (generatedUpTo is authoritative)', () => {
    // Even if rows past generatedUpTo happen to carry segments, the marker is
    // the source of truth: content is only generated up to 2026-07-03.
    const routine = makeRoutine({
      start: '2026-06-27',
      durationDays: 30,
      generatedUpTo: '2026-07-03',
      segsForDay: () => [{ _id: 's' }]
    });
    expect(hasMoreWeeksToGenerate(routine)).toBe(true);
  });
});

describe('calculateDaysUntilExam', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for empty or invalid examDate', () => {
    expect(calculateDaysUntilExam(null)).toBeNull();
    expect(calculateDaysUntilExam('')).toBeNull();
    expect(calculateDaysUntilExam('invalid')).toBeNull();
  });

  it('calculates difference relative to today when startDate is omitted', () => {
    // Today is 2026-08-17
    expect(calculateDaysUntilExam('2026-08-18')).toBe(1);
    expect(calculateDaysUntilExam('2026-08-17')).toBe(0);
    expect(calculateDaysUntilExam('2026-08-16')).toBe(-1);
    expect(calculateDaysUntilExam('2026-09-16')).toBe(30);
    expect(calculateDaysUntilExam('2026-09-30')).toBe(44);
  });

  it('calculates difference relative to custom startDate', () => {
    expect(calculateDaysUntilExam('2026-09-30', '2026-09-01')).toBe(29);
    expect(calculateDaysUntilExam('2026-10-15', '2026-08-20')).toBe(56);
  });
});

describe('formatRemainingTimeline', () => {
  it('returns empty string for null / undefined', () => {
    expect(formatRemainingTimeline(null)).toBe('');
    expect(formatRemainingTimeline(undefined)).toBe('');
  });

  it('formats past or zero days', () => {
    expect(formatRemainingTimeline(-5)).toBe('Past date');
    expect(formatRemainingTimeline(0)).toBe('Today');
  });

  it('formats single and short day durations', () => {
    expect(formatRemainingTimeline(1)).toBe('Tomorrow (1 day)');
    expect(formatRemainingTimeline(15)).toBe('15 days');
    expect(formatRemainingTimeline(29)).toBe('29 days');
  });

  it('formats months and remaining days', () => {
    expect(formatRemainingTimeline(30)).toBe('1 month');
    expect(formatRemainingTimeline(60)).toBe('2 months');
    expect(formatRemainingTimeline(45)).toBe('1 month, 15 days');
    expect(formatRemainingTimeline(61)).toBe('2 months, 1 day');
  });
});

