import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import StatsBar from '../StatsBar';

function makeRoutine(segmentsByDay) {
  return {
    routine: (segmentsByDay || []).map((s, i) => ({
      _id: `d${i}`,
      day: 'Monday',
      dayDate: '2024-09-16T00:00:00.000Z',
      segments: s
    }))
  };
}

afterEach(cleanup);

describe('StatsBar', () => {
  it('renders streak chip with 0', () => {
    render(<StatsBar stats={{ streakDays: 0, overallCompletionPct: 0, bySubject: {} }} routine={makeRoutine([])} />);
    expect(screen.getByText('day streak')).toBeTruthy();
  });

  it('renders streak chip with positive number', () => {
    render(<StatsBar stats={{ streakDays: 5, overallCompletionPct: 0, bySubject: {} }} routine={makeRoutine([])} />);
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('shows progress percentage', () => {
    render(<StatsBar stats={{ streakDays: 0, overallCompletionPct: 42, bySubject: {} }} routine={makeRoutine([])} />);
    expect(screen.getByText('42%')).toBeTruthy();
  });

  it('shows completed / total count', () => {
    const routine = makeRoutine([
      [{ _id: 's1', completed: true }, { _id: 's2', completed: false }]
    ]);
    render(<StatsBar stats={{ streakDays: 0, overallCompletionPct: 50, bySubject: {} }} routine={routine} />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText(/done/)).toBeTruthy();
  });

  it('shows subject chips', () => {
    const stats = {
      streakDays: 0,
      overallCompletionPct: 50,
      bySubject: {
        Physics: { planned: 4, done: 2, pct: 50 },
        Chemistry: { planned: 2, done: 1, pct: 50 }
      }
    };
    render(<StatsBar stats={stats} routine={makeRoutine([])} />);
    expect(screen.getByText('Physics')).toBeTruthy();
    expect(screen.getByText('Chemistry')).toBeTruthy();
    expect(screen.getAllByText('50%')).toHaveLength(3);
  });

  it('shows "No subjects yet" when bySubject is empty', () => {
    render(<StatsBar stats={{ streakDays: 0, overallCompletionPct: 0, bySubject: {} }} routine={makeRoutine([])} />);
    expect(screen.getByText('No subjects yet')).toBeTruthy();
  });

  it('shows exam countdown for future exam date', () => {
    render(
      <StatsBar
        stats={{ streakDays: 0, overallCompletionPct: 0, bySubject: {} }}
        routine={makeRoutine([])}
        examDate="2028-10-16T00:00:00.000Z"
      />
    );
    expect(screen.getByText(/days until exam/)).toBeTruthy();
  });

  it('shows "Exam today" for today', () => {
    const today = new Date();
    const todayStr = today.toISOString();
    render(
      <StatsBar
        stats={{ streakDays: 0, overallCompletionPct: 0, bySubject: {} }}
        routine={makeRoutine([])}
        examDate={todayStr}
      />
    );
    expect(screen.getByText('Exam today')).toBeTruthy();
  });

  it('shows expired badge when isExpired is true', () => {
    render(
      <StatsBar
        stats={{ streakDays: 0, overallCompletionPct: 0, bySubject: {} }}
        routine={makeRoutine([])}
        examDate="2024-01-01T00:00:00.000Z"
        isExpired={true}
      />
    );
    expect(screen.getByText('Exam date passed')).toBeTruthy();
  });

  it('does not show countdown for past exam without isExpired', () => {
    render(
      <StatsBar
        stats={{ streakDays: 0, overallCompletionPct: 0, bySubject: {} }}
        routine={makeRoutine([])}
        examDate="2024-01-01T00:00:00.000Z"
      />
    );
    expect(screen.queryByText(/Exam/)).toBeNull();
  });
});
