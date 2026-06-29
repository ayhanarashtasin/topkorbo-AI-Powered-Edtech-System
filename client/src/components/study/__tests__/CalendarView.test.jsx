import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CalendarView from '../CalendarView';

// react-big-calendar requires moment and the momentLocalizer. We mock the
// Calendar from rbc so it renders a simplified stub in tests.
vi.mock('react-big-calendar', () => ({
  Calendar: ({ date, events, onSelectSlot, onSelectEvent, dayPropGetter }) => (
    <div data-testid="rbc-calendar" data-date={date ? date.toISOString() : ''}>
      <span data-testid="event-count">{events.length}</span>
      <button
        data-testid="select-slot"
        onClick={() => onSelectSlot && onSelectSlot({ start: new Date('2024-09-16T00:00:00.000Z') })}
      >
        Select Slot
      </button>
      <button
        data-testid="select-event"
        onClick={() => onSelectEvent && onSelectEvent({ start: new Date('2024-09-16T00:00:00.000Z'), resource: {} })}
      >
        Select Event
      </button>
      {dayPropGetter && (
        <span data-testid="day-prop-today">{JSON.stringify(dayPropGetter(new Date()))}</span>
      )}
    </div>
  ),
  momentLocalizer: () => 'localizer'
}));

describe('CalendarView', () => {
  afterEach(() => { cleanup(); });

  it('renders with routine events', () => {
    const routine = {
      routine: [
        {
          _id: 'd1',
          dayDate: '2024-09-16T00:00:00.000Z',
          segments: [
            {
              _id: 's1',
              subject: 'Physics',
              startAt: '2024-09-16T01:00:00.000Z',
              endAt: '2024-09-16T02:30:00.000Z',
              completed: false,
              priority: 'medium',
              time: '7:00 AM'
            }
          ]
        }
      ]
    };
    render(<CalendarView routine={routine} />);
    expect(screen.getByTestId('rbc-calendar')).toBeTruthy();
    expect(screen.getByTestId('event-count').textContent).toBe('1');
  });

  it('calls onSelectDay when slot selected', () => {
    const onSelectDay = vi.fn();
    const routine = { routine: [] };
    render(<CalendarView routine={routine} onSelectDay={onSelectDay} />);
    screen.getAllByTestId('select-slot')[0].click();
    expect(onSelectDay).toHaveBeenCalledWith('2024-09-16');
  });

  it('calls onSelectDay when event selected', () => {
    const onSelectDay = vi.fn();
    const routine = { routine: [] };
    render(<CalendarView routine={routine} onSelectDay={onSelectDay} />);
    screen.getAllByTestId('select-event')[0].click();
    expect(onSelectDay).toHaveBeenCalledWith('2024-09-16');
  });
});
