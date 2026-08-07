import { describe, expect, it } from 'vitest';
import { buildStudentAnalytics, getHeatLevel } from './dashboardAnalytics';

describe('dashboardAnalytics', () => {
  it('builds the 53-week calendar and solved statistics', () => {
    const result = buildStudentAnalytics([
      { date: '2026-08-01', solved: 2 },
      { date: '2026-08-02', solved: 3 },
      { date: '2026-08-04', solved: 1 }
    ], new Date(2026, 7, 7));

    expect(result.weeks).toHaveLength(53);
    expect(result.weeks.every((week) => week.length === 7)).toBe(true);
    expect(result.monthLabels).toHaveLength(53);
    expect(result.stats).toEqual({
      solvedAllTime: 6,
      solvedLastYear: 6,
      solvedLastMonth: 6,
      maxStreakAllTime: 2,
      maxStreakLastYear: 2,
      maxStreakLastMonth: 2
    });
  });

  it('merges duplicate days and ignores malformed values', () => {
    const result = buildStudentAnalytics([
      { date: '2026-08-05', solved: 2 },
      { date: '2026-08-05', solved: 3 },
      { date: 'invalid', solved: 9 },
      { date: '2026-08-06', solved: 0 }
    ], new Date(2026, 7, 7));

    expect(result.stats.solvedAllTime).toBe(5);
    expect(result.stats.maxStreakAllTime).toBe(1);
  });

  it('returns empty statistics without activity', () => {
    const result = buildStudentAnalytics([], new Date(2026, 7, 7));

    expect(result.stats).toEqual({
      solvedAllTime: 0,
      solvedLastYear: 0,
      solvedLastMonth: 0,
      maxStreakAllTime: 0,
      maxStreakLastYear: 0,
      maxStreakLastMonth: 0
    });
  });

  it('maps solved totals to the existing heat levels', () => {
    expect([0, 1, 3, 5, 7].map(getHeatLevel)).toEqual([0, 1, 2, 3, 4]);
  });
});
