/**
 * Date utilities for study-routine generation.
 * Used by the AI prompt builder to pre-compute dates and by controllers
 * to backfill missing dayDate / startAt / endAt fields when the AI emits
 * a routine without them.
 */

const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday'
];

/** Returns the date with time stripped (00:00:00.000Z) */
function startOfDay(d) {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

/** Returns an ISO YYYY-MM-DD string for a Date */
function toISODate(d) {
  return startOfDay(d).toISOString().slice(0, 10);
}

/**
 * Generate `durationDays` consecutive day entries starting at `startDate`,
 * skipping a fixed set of rest weekdays so the student works
 * `studyDaysPerWeek` days per week.
 *
 * @param {Object} opts
 * @param {Date|string} opts.startDate - First day of the routine.
 * @param {number} opts.durationDays - Total number of days (30, 35, or 40).
 * @param {number} opts.studyDaysPerWeek - 1-7. The number of study days per week.
 * @returns {Array<{dayDate: string, day: string, isRest: boolean}>}
 */
function generateDayPlan({ startDate, durationDays, studyDaysPerWeek }) {
  if (!startDate || !Number.isFinite(durationDays) || durationDays <= 0) return [];
  const start = startOfDay(startDate);
  const perWeek = Math.min(7, Math.max(1, Number(studyDaysPerWeek) || 7));
  // Spread rest days evenly. With perWeek=7 → no rest. With perWeek=6 → 1 rest / week.
  // With perWeek=5 → 2 rest / week (Saturday & Sunday for Bangladesh weekend, etc.).
  const restDaysPerWeek = 7 - perWeek;

  // Choose which weekdays are "rest" relative to the start of the week
  // containing startDate. Spread them out (e.g. day index 0 and 3 of the week
  // for 5-day weeks).
  const restDayIndexes = [];
  if (restDaysPerWeek > 0) {
    const step = 7 / restDaysPerWeek;
    for (let i = 0; i < restDaysPerWeek; i++) {
      restDayIndexes.push(Math.floor(i * step));
    }
  }

  const out = [];
  const startWeekday = start.getUTCDay(); // 0=Sun ... 6=Sat
  for (let i = 0; i < durationDays; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const weekdayIdx = (startWeekday + i) % 7;
    const isRest = restDayIndexes.includes(weekdayIdx);
    out.push({
      dayDate: toISODate(d),
      day: WEEKDAY_NAMES[weekdayIdx],
      isRest
    });
  }
  return out;
}

/**
 * Backfill dayDate / startAt / endAt / estimatedMinutes / priority on segments
 * when the AI omits them. Walks the routine day-by-day and assigns each
 * segment a default 90-minute window starting at the student's wake-up time
 * expressed as UTC.
 *
 * The timezoneOffsetHours parameter converts the local wakeUp hour to its UTC
 * equivalent. For Bangladesh (UTC+6), local 7 AM = UTC 1 AM, so offset = 6.
 *
 * @param {Array} routine - the routine array from AI
 * @param {Object} defaults
 * @param {number} [defaults.wakeUpHour=7] - Wake-up hour in LOCAL time
 * @param {number} [defaults.defaultSegmentMinutes=90]
 * @param {number} [defaults.timezoneOffsetHours=6] - Hours AHEAD of UTC
 * @returns {Array} routine with date fields filled in
 */
function backfillDates(routine, defaults = {}) {
  if (!Array.isArray(routine)) return routine;
  const wakeUp = defaults.wakeUpHour ?? 7;
  const defaultSegmentMinutes = defaults.defaultSegmentMinutes ?? 90;
  const tzOffsetHours = defaults.timezoneOffsetHours ?? 6;

  let cursor = new Date();
  const cursorUtcHour = wakeUp - tzOffsetHours;
  cursor.setUTCHours(cursorUtcHour, 0, 0, 0);

  return routine.map((day, dayIdx) => {
    let dayDate = day.dayDate ? new Date(day.dayDate) : new Date(cursor);
    if (!day.dayDate) {
      const offset = new Date();
      offset.setUTCDate(offset.getUTCDate() + dayIdx);
      offset.setUTCHours(0, 0, 0, 0);
      dayDate = offset;
    }
    day.dayDate = dayDate.toISOString();

    let segStart = new Date(dayDate);
    const utcHour = wakeUp - tzOffsetHours;
    segStart.setUTCHours(utcHour, 0, 0, 0);

    const segs = Array.isArray(day.segments) ? day.segments : [];
    day.segments = segs.map((seg) => {
      if (!seg.startAt) {
        seg.startAt = segStart.toISOString();
        const mins = seg.estimatedMinutes || defaultSegmentMinutes;
        const segEnd = new Date(segStart.getTime() + mins * 60_000);
        seg.endAt = segEnd.toISOString();
        segStart = segEnd;
      }
      if (!seg.estimatedMinutes && seg.startAt && seg.endAt) {
        seg.estimatedMinutes = Math.round(
          (new Date(seg.endAt) - new Date(seg.startAt)) / 60_000
        );
      }
      if (!seg.priority) {
        const subj = (seg.subject || '').toLowerCase();
        if (subj === 'break' || subj === 'college' || subj === 'rest' || subj === 'morning routine') {
          seg.priority = 'low';
        } else {
          seg.priority = 'medium';
        }
      }
      if (typeof seg.completed !== 'boolean') seg.completed = false;
      return seg;
    });
    return day;
  });
}

module.exports = {
  WEEKDAY_NAMES,
  startOfDay,
  toISODate,
  generateDayPlan,
  backfillDates
};