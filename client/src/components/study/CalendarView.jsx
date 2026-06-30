import { useState, useMemo } from 'react';
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

export default function CalendarView({ routine, selectedDayKey, onSelectDay, height = 560, generatedUpTo }) {
  const events = eventsFromRoutine(routine);
  const [view, setView] = useState('week');
  const [internalDate, setInternalDate] = useState(
    selectedDayKey ? new Date(selectedDayKey + 'T00:00:00') : new Date()
  );

  const calendarDate = useMemo(() => {
    if (selectedDayKey) return new Date(selectedDayKey + 'T00:00:00');
    return internalDate;
  }, [selectedDayKey, internalDate]);

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

  const handleSelectSlot = ({ start }) => {
    const y = start.getFullYear();
    const m = String(start.getMonth() + 1).padStart(2, '0');
    const d = String(start.getDate()).padStart(2, '0');
    if (onSelectDay) onSelectDay(`${y}-${m}-${d}`);
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
        onNavigate={(date) => setInternalDate(date)}
        defaultView="week"
        views={['month', 'week', 'day', 'agenda']}
        startAccessor="start"
        endAccessor="end"
        selectable
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
              opacity: r.dayCompleted ? 0.7 : 1,
              padding: 0,
              borderRadius: 6
            }
          };
        }}
        dayPropGetter={useMemo(() => (date) => {
          const key = toISODate(date);
          const style = {};
          if (key === todayKey()) {
            style.background = 'rgba(31,122,109,0.05)';
          }
          if (selectedDayKey && key === selectedDayKey) {
            style.background = 'rgba(31,122,109,0.15)';
            style.outline = '2px solid #1f7a6d';
            style.outlineOffset = '-2px';
          }
          // Style placeholder days (after generatedUpTo, no events)
          if (generatedUpTo && key > generatedUpTo.slice(0, 10)) {
            const hasEvents = events.some((e) => toISODate(e.start) === key);
            if (!hasEvents) {
              style.background = 'rgba(148,163,184,0.08)';
              style.borderBottom = '2px dashed rgba(148,163,184,0.4)';
            }
          }
          return Object.keys(style).length ? { style } : {};
        }, [selectedDayKey, generatedUpTo, events])}
      />
    </div>
  );
}