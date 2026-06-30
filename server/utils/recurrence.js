const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday'
];

function startOfDay(d) {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function toISODate(d) {
  return startOfDay(d).toISOString().slice(0, 10);
}

function generateDayPlan({ startDate, durationDays, studyDaysPerWeek }) {
  if (!startDate || !Number.isFinite(durationDays) || durationDays <= 0) return [];
  const start = startOfDay(startDate);
  const perWeek = Math.min(7, Math.max(1, Number(studyDaysPerWeek) || 7));
  const restDaysPerWeek = 7 - perWeek;

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


function backfillDates(routine, defaults = {}) {
  if (!Array.isArray(routine)) return routine;
  const wakeUp = defaults.wakeUpHour ?? 7;
  const defaultSegmentMinutes = defaults.defaultSegmentMinutes ?? 90;
  const tzOffsetHours = defaults.timezoneOffsetHours ?? 6;

  return routine.map((day, dayIdx) => {
    let dayDate = day.dayDate ? new Date(day.dayDate) : null;
    if (!dayDate || isNaN(dayDate.getTime())) {
      dayDate = new Date();
      dayDate.setUTCDate(dayDate.getUTCDate() + dayIdx);
      dayDate.setUTCHours(0, 0, 0, 0);
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