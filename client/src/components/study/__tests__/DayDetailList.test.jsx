import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import DayDetailList from '../DayDetailList';

function makeDay(segments = [], overrides = {}) {
  return {
    _id: 'day1',
    day: 'Monday',
    dayDate: '2024-09-16T00:00:00.000Z',
    segments: segments.map((s, i) => ({
      _id: `seg${i}`,
      subject: 'Physics',
      time: '7:00 AM',
      completed: false,
      priority: 'medium',
      ...s
    })),
    ...overrides
  };
}

describe('DayDetailList', () => {
  afterEach(cleanup);
  it('shows empty state when no day provided', () => {
    render(<DayDetailList day={null} dayKey="2024-09-16" />);
    expect(screen.getByText('Select a day from the calendar to view your plan.')).toBeTruthy();
  });

  it('renders segments with completion count', () => {
    const day = makeDay([
      { completed: true },
      { completed: false }
    ]);
    render(<DayDetailList day={day} dayKey="2024-09-16" />);
    expect(screen.getByText('1 / 2 completed')).toBeTruthy();
  });

  it('shows "Today" tag for today', () => {
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, '0');
    const d = String(today.getUTCDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    const day = makeDay([{ completed: false }], {
      dayDate: `${todayStr}T00:00:00.000Z`
    });
    render(<DayDetailList day={day} dayKey={todayStr} />);
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('shows "Past" tag for past dates', () => {
    const day = makeDay([{ completed: false }], {
      dayDate: '2024-01-01T00:00:00.000Z'
    });
    render(<DayDetailList day={day} dayKey="2024-01-01" />);
    expect(screen.getByText('Past')).toBeTruthy();
  });

  it('renders expired banner when isExpired is true', () => {
    const day = makeDay([{ completed: false }]);
    render(<DayDetailList day={day} dayKey="2024-09-16" isExpired={true} />);
    expect(screen.getByText(/exam date has passed/)).toBeTruthy();
  });

  it('shows rest day message for empty segments', () => {
    const day = makeDay([]);
    render(<DayDetailList day={day} dayKey="2024-09-16" />);
    expect(screen.getByText(/Rest day/)).toBeTruthy();
  });

  it('calls onToggle when segment is clicked', async () => {
    const onToggle = vi.fn();
    const day = makeDay([{ completed: false }]);
    render(<DayDetailList day={day} dayKey="2024-09-16" onToggle={onToggle} />);
    const check = screen.getByText('Physics').closest('.routine-segment__info') ||
                  screen.getByText('Physics');
    check.click();
    expect(onToggle).toHaveBeenCalledWith('day1', 'seg0', false);
  });

  it('does not call onToggle when isExpired', () => {
    const onToggle = vi.fn();
    const day = makeDay([{ completed: false }]);
    render(<DayDetailList day={day} dayKey="2024-09-16" onToggle={onToggle} isExpired={true} />);
    const check = screen.getByText('Physics');
    check.click();
    expect(onToggle).not.toHaveBeenCalled();
  });
});
