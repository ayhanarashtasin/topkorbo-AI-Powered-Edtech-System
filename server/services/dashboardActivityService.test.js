const mongoose = require('mongoose');
const PracticeAttempt = require('../models/PracticeAttempt');
const {
  buildDashboardActivityPipeline,
  getDashboardActivity,
  normalizeDashboardTimeZone
} = require('./dashboardActivityService');

describe('dashboardActivityService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('normalizes valid timezones and defaults to UTC', () => {
    expect(normalizeDashboardTimeZone(' Asia/Dhaka ')).toBe('Asia/Dhaka');
    expect(normalizeDashboardTimeZone()).toBe('UTC');
  });

  test('rejects invalid timezone input', () => {
    expect(() => normalizeDashboardTimeZone('not a timezone')).toThrow('Invalid timezone.');
    expect(() => normalizeDashboardTimeZone('../Asia/Dhaka')).toThrow('Invalid timezone.');
  });

  test('builds an owner-scoped aggregation pipeline', () => {
    const userId = new mongoose.Types.ObjectId();
    const pipeline = buildDashboardActivityPipeline(userId, 'Asia/Dhaka');

    expect(pipeline[0]).toEqual({ $match: { userId, isDeleted: false } });
    expect(pipeline[1].$project.day.$dateToString.timezone).toBe('Asia/Dhaka');
    expect(pipeline.at(-1)).toEqual({ $sort: { _id: 1 } });
  });

  test('returns compact daily solved totals', async () => {
    jest.spyOn(PracticeAttempt, 'aggregate').mockResolvedValue([
      { _id: '2026-08-05', solved: 3 },
      { _id: '2026-08-06', solved: 5 }
    ]);

    const result = await getDashboardActivity(new mongoose.Types.ObjectId(), 'UTC');

    expect(result).toEqual({
      timeZone: 'UTC',
      days: [
        { date: '2026-08-05', solved: 3 },
        { date: '2026-08-06', solved: 5 }
      ]
    });
  });
});
