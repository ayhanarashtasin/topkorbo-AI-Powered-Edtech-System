import React, { useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { eventsFromRoutine, toISODate, todayKey } from '../../utils/dateHelpers';

const localizer = momentLocalizer(moment);

const SUBJECT_COLORS = {
  Physics: '#3b82f6',
  Chemistry: '#10b981',
  Math: '#8b5cf6',
  Mathematics: '#8b5cf6',
  Biology: '#22c55e',
  English: '#f59e0b',
  Bangla: '#ef4444',
  Break: '#94a3b8',
  College: '#64748b',
  Rest: '#cbd5e1',
  'Morning Routine': '#fbbf24'
};

function colorForSubject(subject) {
  if (!subject) return '#1f7a6d';
  return SUBJECT_COLORS[subject] || '#1f7a6d';
}

/**
 * CalendarView — wraps react-big-calendar with routine events.
 *
 * Props:
 *  - routine: full routine doc (with .routine array of days)
 *  - selectedDayKey: YYYY-MM-DD currently selected
 *  - onSelectDay: (dayKey) => void
 *  - height: optional CSS height (default 560px)
 */
export default function CalendarView({ routine, selectedDayKey, onSelectDay, height = 560 }) {
  const events = eventsFromRoutine(routine);
  const [view, setView] = useState('week');

  // Compute the date the calendar should be on — prefers selectedDayKey, else today.
  const calendarDate = selectedDayKey ? new Date(selectedDayKey) : new Date();

  // Custom event renderer
  const EventComponent = ({ event }) => {
    const r = event.resource || {};
    const color = colorForSubject(event.title);
    const completed = r.completed;
    return (
      <div
        className={`routine-cal-event ${completed ? 'routine-cal-event--done' : ''}`}
        title={`${event.title}${r.paper ? ` • ${r.paper}` : ''}${r.chapter ? ` — ${r.chapter}` : ''}${r.task ? `\n${r.task}` : ''}`}
      >
        <span
          className="routine-cal-event__dot"
          style={{ background: color }}
        />
        <span className="routine-cal-event__title" style={{ color }}>
          {event.title}
        </span>
        {r.time && <span className="routine-cal-event__time">{r.time}</span>}
      </div>
    );
  };

  // Toolbar label: navigate back/forward. We pass currentDate so the calendar
  // jumps to the right month/week when selectedDayKey changes.
  const handleSelectSlot = ({ start }) => {
    if (onSelectDay) onSelectDay(toISODate(start));
  };

  const handleSelectEvent = (event) => {
    if (onSelectDay) onSelectDay(toISODate(event.start));
  };

  return (
    <div className="routine-calendar-wrap" style={{ height }}>
      <Calendar
        localizer={localizer}
        events={events}
        date={calendarDate}
        view={view}
        onView={setView}
        defaultView="week"
        views={['month', 'week', 'day', 'agenda']}
        startAccessor="start"
        endAccessor="end"
        selectable
        onNavigate={(newDate) => {
          if (onSelectDay) onSelectDay(toISODate(newDate));
        }}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        components={{ event: EventComponent }}
        eventPropGetter={(event) => {
          const r = event.resource || {};
          const color = colorForSubject(event.title);
          return {
            style: {
              background: r.completed ? 'rgba(46,125,50,0.08)' : 'rgba(31,122,109,0.06)',
              borderLeft: `3px solid ${color}`,
              border: 'none',
              borderLeft: `3px solid ${color}`,
              opacity: r.dayCompleted ? 0.7 : 1,
              padding: 0,
              borderRadius: 6
            }
          };
        }}
        dayPropGetter={(date) => {
          const key = toISODate(date);
          if (key === todayKey()) {
            return { style: { background: 'rgba(31,122,109,0.05)' } };
          }
          return {};
        }}
      />
    </div>
  );
}