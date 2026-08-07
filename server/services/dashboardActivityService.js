const mongoose = require('mongoose');
const PracticeAttempt = require('../models/PracticeAttempt');

const DEFAULT_TIME_ZONE = 'UTC';
const MAX_TIME_ZONE_LENGTH = 64;
const TIME_ZONE_PATTERN = /^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)*$/;

function invalidTimeZoneError() {
  const error = new Error('Invalid timezone.');
  error.code = 'INVALID_TIME_ZONE';
  return error;
}

function normalizeDashboardTimeZone(value) {
  const timeZone = typeof value === 'string' && value.trim()
    ? value.trim()
    : DEFAULT_TIME_ZONE;

  if (timeZone.length > MAX_TIME_ZONE_LENGTH || !TIME_ZONE_PATTERN.test(timeZone)) {
    throw invalidTimeZoneError();
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0));
  } catch (_) {
    throw invalidTimeZoneError();
  }

  return timeZone;
}

function buildDashboardActivityPipeline(userId, timeZone) {
  const normalizedUserId = userId instanceof mongoose.Types.ObjectId
    ? userId
    : new mongoose.Types.ObjectId(String(userId));

  return [
    { $match: { userId: normalizedUserId, isDeleted: false } },
    {
      $project: {
        day: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt',
            timezone: timeZone
          }
        },
        solved: {
          $size: {
            $filter: {
              input: { $ifNull: ['$questions', []] },
              as: 'question',
              cond: { $eq: ['$$question.isCorrect', true] }
            }
          }
        }
      }
    },
    { $group: { _id: '$day', solved: { $sum: '$solved' } } },
    { $match: { solved: { $gt: 0 } } },
    { $sort: { _id: 1 } }
  ];
}

async function getDashboardActivity(userId, requestedTimeZone) {
  const timeZone = normalizeDashboardTimeZone(requestedTimeZone);
  const rows = await PracticeAttempt.aggregate(
    buildDashboardActivityPipeline(userId, timeZone)
  );

  return {
    timeZone,
    days: rows.map((row) => ({
      date: row._id,
      solved: Number(row.solved) || 0
    }))
  };
}

module.exports = {
  buildDashboardActivityPipeline,
  getDashboardActivity,
  normalizeDashboardTimeZone
};
