/** Return YYYY-MM-DD string for `date`. Uses UTC to avoid timezone drift. */
export function toISODate(date) {
  if (!date) return null;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return date.substring(0, 10);
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}


export function todayKey() {
  return toISODate(new Date());
}


export function isToday(dayKey) {
  if (!dayKey) return false;
  return dayKey === todayKey();
}


export function isPast(dayKey) {
  if (!dayKey) return false;
  return dayKey < todayKey();
}


export function isFuture(dayKey) {
  if (!dayKey) return false;
  return dayKey > todayKey();
}


export function formatDayLong(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}


export function formatDayShort(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}


export function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}


export function eventsFromRoutine(routine) {
  if (!routine || !Array.isArray(routine.routine)) return [];
  const events = [];
  for (const day of routine.routine) {
    const segs = Array.isArray(day.segments) ? day.segments : [];
    let completed = 0;
    for (const seg of segs) {
      if (seg.completed) completed++;
      const start = seg.startAt ? new Date(seg.startAt) : null;
      const end = seg.endAt ? new Date(seg.endAt) : null;
      if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) continue;
      events.push({
        id: seg._id,
        title: seg.subject || 'Study',
        start,
        end,
        resource: {
          dayId: day._id,
          segmentId: seg._id,
          paper: seg.paper || '',
          chapter: seg.chapter || '',
          task: seg.task || '',
          completed: !!seg.completed,
          priority: seg.priority || 'medium',
          time: seg.time || ''
        }
      });
    }
    const dayCompleted = segs.length > 0 && completed === segs.length;
    for (const e of events) {
      if (e.resource.dayId === day._id) e.resource.dayCompleted = dayCompleted;
    }
  }
  return events;
}


export function findToday(routine) {
  if (!routine?.routine) return null;
  const key = todayKey();
  return routine.routine.find((d) => d.dayDate && toISODate(d.dayDate) === key) || null;
}


export function findDayByKey(routine, dayKey) {
  if (!routine?.routine || !dayKey) return null;
  return routine.routine.find((d) => d.dayDate && toISODate(d.dayDate) === dayKey) || null;
}

/** Show "Generate Next Week" when generatedUpTo is before the plan end */
export function hasMoreWeeksToGenerate(routine) {
  if (!routine?.startDate || !routine?.durationDays) return false;
  if (!routine.generatedUpTo) return false;

  const start = new Date(routine.startDate);
  if (isNaN(start.getTime())) return false;
  const planEnd = new Date(start);
  planEnd.setUTCDate(planEnd.getUTCDate() + routine.durationDays - 1);

  const generated = new Date(routine.generatedUpTo);
  if (isNaN(generated.getTime())) return false;

  const cutoff = toISODate(generated);
  const planEndKey = toISODate(planEnd);
  if (!cutoff || !planEndKey) return false;

  return cutoff < planEndKey;
}

/**
 * Calculate the number of calendar days between a start/base date and a target exam date.
 * Returns null if examDate is invalid, or an integer (positive if exam is in the future).
 * Uses UTC calendar date boundaries to avoid timezone/daylight saving artifacts.
 */
export function calculateDaysUntilExam(examDate, startDate) {
  if (!examDate) return null;
  const examIso = typeof examDate === 'string' ? examDate.substring(0, 10) : toISODate(examDate);
  if (!examIso || !/^\d{4}-\d{2}-\d{2}$/.test(examIso)) return null;

  const [ey, em, ed] = examIso.split('-').map(Number);
  const examUtc = Date.UTC(ey, em - 1, ed);

  let baseUtc;
  if (startDate) {
    const startIso = typeof startDate === 'string' ? startDate.substring(0, 10) : toISODate(startDate);
    if (startIso && /^\d{4}-\d{2}-\d{2}$/.test(startIso)) {
      const [sy, sm, sd] = startIso.split('-').map(Number);
      baseUtc = Date.UTC(sy, sm - 1, sd);
    }
  }

  if (baseUtc === undefined) {
    const now = new Date();
    baseUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const diffMs = examUtc - baseUtc;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Human-readable breakdown of days left (e.g. "Tomorrow (1 day)", "14 days", "2 months, 5 days").
 */
export function formatRemainingTimeline(days) {
  if (days === null || days === undefined || isNaN(days)) return '';
  if (days < 0) return 'Past date';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow (1 day)';
  if (days < 30) return `${days} days`;

  const months = Math.floor(days / 30);
  const remDays = days % 30;
  if (remDays === 0) {
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  }
  return `${months} ${months === 1 ? 'month' : 'months'}, ${remDays} ${remDays === 1 ? 'day' : 'days'}`;
}