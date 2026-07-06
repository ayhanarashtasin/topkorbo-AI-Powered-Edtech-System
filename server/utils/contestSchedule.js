const TZ_OFFSETS = {
  'Asia/Dhaka': '+06:00',
  'Asia/Kolkata': '+05:30',
  'Asia/Dubai': '+04:00',
  'Europe/London': '+00:00',
  'America/New_York': '-05:00',
  'Asia/Tokyo': '+09:00',
  'Asia/Singapore': '+08:00',
  'Australia/Sydney': '+10:00'
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function resolveContestDates(contest) {
  const tz = contest?.startTime?.timezone || 'Asia/Dhaka';
  const offset = TZ_OFFSETS[tz] || '+06:00';
  let hour = contest?.startTime?.hour || 12;
  const minute = contest?.startTime?.minute || 0;
  const period = contest?.startTime?.period || 'AM';

  if (period === 'PM' && hour < 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;

  const startDate = new Date(`${contest.date}T${pad(hour)}:${pad(minute)}:00${offset}`);
  const durationHours = Number(contest?.duration?.hours) || 0;
  const durationMinutes = Number(contest?.duration?.minutes) || 0;
  const endDate = new Date(startDate.getTime() + durationHours * 3600000 + durationMinutes * 60000);

  return { startDate, endDate };
}

function normalizeAdminContestStatus(contest) {
  if (contest?.adminStatus === 'hidden') return 'archived';
  return ['active', 'archived', 'cancelled'].includes(contest?.adminStatus)
    ? contest.adminStatus
    : 'active';
}

function getContestLifecycle(contest, now = new Date()) {
  const adminStatus = normalizeAdminContestStatus(contest);
  if (adminStatus === 'cancelled') return 'cancelled';

  const { startDate, endDate } = resolveContestDates(contest);
  if (endDate < now) return 'ended';
  if (startDate <= now && now <= endDate) return 'live';
  return 'upcoming';
}

module.exports = {
  TZ_OFFSETS,
  resolveContestDates,
  normalizeAdminContestStatus,
  getContestLifecycle
};
