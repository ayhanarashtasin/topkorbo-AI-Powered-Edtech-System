/**
 * Date helpers used by the Study Routine calendar view.
 * Pure functions; no React imports.
 */

/** Return YYYY-MM-DD string for `date`. Prevents timezone shifts if already an ISO string. */
export function toISODate(date) {
  if (!date) return null;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return date.substring(0, 10);
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Today's date key in local time. */
export function todayKey() {
  return toISODate(new Date());
}

/** True if the given dayKey (YYYY-MM-DD) is today. */
export function isToday(dayKey) {
  if (!dayKey) return false;
  return dayKey === todayKey();
}

/** True if `dayKey` is strictly before today. */
export function isPast(dayKey) {
  if (!dayKey) return false;
  return dayKey < todayKey();
}

/** True if `dayKey` is strictly after today. */
export function isFuture(dayKey) {
  if (!dayKey) return false;
  return dayKey > todayKey();
}

/** Long-form label: "Wednesday, June 25" */
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

/** Short label: "Jun 25" */
export function formatDayShort(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** 24h time: "07:30" */
export function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Convert a routine day into a flat array of `react-big-calendar` event objects.
 * Each segment becomes its own event with start/end datetimes.
 */
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
    // Tag day-level completion on each event for color
    const dayCompleted = segs.length > 0 && completed === segs.length;
    for (const e of events) {
      if (e.resource.dayId === day._id) e.resource.dayCompleted = dayCompleted;
    }
  }
  return events;
}

/**
 * Walk back from today through the routine's days and count consecutive
 * fully-completed days. Returns 0 if today is not in the routine yet.
 */
export function streakFromRoutine(routine) {
  if (!routine || !Array.isArray(routine.routine)) return 0;
  const map = new Map();
  for (const day of routine.routine) {
    if (!day.dayDate) continue;
    map.set(toISODate(day.dayDate), day);
  }
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const key = toISODate(cursor);
    const day = map.get(key);
    if (!day) break;
    const segs = Array.isArray(day.segments) ? day.segments : [];
    if (segs.length === 0) break;
    const allDone = segs.every((s) => s.completed);
    if (allDone) streak++;
    else break;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Returns today's routine day or null. */
export function findToday(routine) {
  if (!routine?.routine) return null;
  const key = todayKey();
  return routine.routine.find((d) => d.dayDate && toISODate(d.dayDate) === key) || null;
}

/** Find a routine day by ISO dayKey. */
export function findDayByKey(routine, dayKey) {
  if (!routine?.routine || !dayKey) return null;
  return routine.routine.find((d) => d.dayDate && toISODate(d.dayDate) === dayKey) || null;
}