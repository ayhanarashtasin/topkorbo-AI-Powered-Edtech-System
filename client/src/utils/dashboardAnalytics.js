const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toLocalDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getHeatLevel(solved) {
  if (solved <= 0) return 0;
  if (solved <= 2) return 1;
  if (solved <= 4) return 2;
  if (solved <= 6) return 3;
  return 4;
}

export function buildStudentAnalytics(activityDays = [], now = new Date()) {
  const solvedByDay = new Map();
  for (const entry of activityDays) {
    if (!entry || !DATE_KEY_PATTERN.test(entry.date || '')) continue;
    const solved = Number(entry.solved);
    if (!Number.isFinite(solved) || solved <= 0) continue;
    solvedByDay.set(entry.date, (solvedByDay.get(entry.date) || 0) + solved);
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const weekCount = 53;
  const gridStart = new Date(today);
  gridStart.setDate(today.getDate() - today.getDay() - (weekCount - 1) * 7);

  const weeks = [];
  const monthLabels = [];
  let previousMonth = -1;
  for (let week = 0; week < weekCount; week += 1) {
    const column = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + week * 7 + dayOfWeek);
      if (cellDate > today) {
        column.push(null);
      } else {
        const key = toLocalDateKey(cellDate);
        column.push({ date: key, solved: solvedByDay.get(key) || 0 });
      }
    }

    const weekStart = new Date(gridStart);
    weekStart.setDate(gridStart.getDate() + week * 7);
    const month = weekStart.getMonth();
    monthLabels.push(month !== previousMonth ? MONTH_LABELS[month] : '');
    previousMonth = month;
    weeks.push(column);
  }

  const yearAgo = new Date(today);
  yearAgo.setDate(today.getDate() - 364);
  const monthAgo = new Date(today);
  monthAgo.setDate(today.getDate() - 29);

  let solvedAllTime = 0;
  let solvedLastYear = 0;
  let solvedLastMonth = 0;
  solvedByDay.forEach((solved, key) => {
    solvedAllTime += solved;
    const date = parseDateKey(key);
    if (date >= yearAgo && date <= today) solvedLastYear += solved;
    if (date >= monthAgo && date <= today) solvedLastMonth += solved;
  });

  const activeKeys = [...solvedByDay.keys()].sort();
  const activeSet = new Set(activeKeys);
  const earliest = activeKeys.length ? parseDateKey(activeKeys[0]) : today;
  const maxStreakInRange = (startDate) => {
    let max = 0;
    let current = 0;
    const cursor = new Date(startDate);
    while (cursor <= today) {
      if (activeSet.has(toLocalDateKey(cursor))) {
        current += 1;
        if (current > max) max = current;
      } else {
        current = 0;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return max;
  };

  return {
    weeks,
    monthLabels,
    stats: {
      solvedAllTime,
      solvedLastYear,
      solvedLastMonth,
      maxStreakAllTime: maxStreakInRange(earliest),
      maxStreakLastYear: maxStreakInRange(yearAgo),
      maxStreakLastMonth: maxStreakInRange(monthAgo)
    }
  };
}
