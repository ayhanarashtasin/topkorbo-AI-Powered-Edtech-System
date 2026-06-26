import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  HiCheckCircle,
  HiOutlineCheckCircle,
  HiPencil,
  HiCheck,
  HiX,
  HiClock
} from 'react-icons/hi';
import { isToday, formatDayLong, isPast } from '../../utils/dateHelpers';

/**
 * DayDetailList — renders the segments of a single routine day.
 *
 * Props:
 *  - day: routine day object with segments[]
 *  - dayKey: YYYY-MM-DD string for this day
 *  - onToggle: (dayId, segmentId, currentCompleted) => void
 *  - onEdit: (dayId, segment, fields) => Promise
 *  - onStartFocus: (dayId, segment) => void (Phase 2 hook; for now shows a toast)
 */
export default function DayDetailList({ day, dayKey, onToggle, onEdit, onStartFocus }) {
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});

  if (!day) {
    return (
      <div className="routine-day-detail routine-day-detail--empty">
        <p>Select a day from the calendar to view your plan.</p>
      </div>
    );
  }

  const segs = Array.isArray(day.segments) ? day.segments : [];
  const done = segs.filter((s) => s.completed).length;
  const isCurrentToday = isToday(dayKey);
  const isPastDay = isPast(dayKey);

  const startEdit = (seg) => {
    setEditingId(seg._id);
    setEditFields({
      time: seg.time || '',
      subject: seg.subject || '',
      paper: seg.paper || '',
      chapter: seg.chapter || '',
      task: seg.task || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFields({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await onEdit(day._id, segs.find((s) => s._id === editingId), editFields);
      toast.success('Segment updated');
      cancelEdit();
    } catch {
      toast.error('Failed to save edit');
    }
  };

  const handleStartFocus = (seg) => {
    if (onStartFocus) {
      onStartFocus(day._id, seg);
    } else {
      toast('🎯 Focus mode is coming in the next update!', { icon: '⏱️' });
    }
  };

  return (
    <div className="routine-day-detail">
      <div className="routine-day-detail__header">
        <div>
          <h4>{formatDayLong(day.dayDate || dayKey)}</h4>
          <span className="routine-day-detail__sub">
            {day.day}
            {isCurrentToday && <span className="routine-day-detail__today-tag">Today</span>}
            {isPastDay && !isCurrentToday && <span className="routine-day-detail__past-tag">Past</span>}
          </span>
        </div>
        <span className="routine-day-progress">
          {done} / {segs.length} completed
        </span>
      </div>

      <div className="routine-day-detail__segments">
        {segs.length === 0 && (
          <div className="routine-day-detail__empty">
            <p>🌴 Rest day — take a break or review.</p>
          </div>
        )}
        {segs.map((seg) => {
          const isEditing = editingId === seg._id;
          const priority = seg.priority || 'medium';
          return (
            <div
              key={seg._id}
              className={`routine-segment ${seg.completed ? 'routine-segment--completed' : ''} routine-segment--priority-${priority}`}
            >
              {isEditing ? (
                <div className="routine-segment__edit-form">
                  <div className="routine-segment__edit-row">
                    <input
                      placeholder="Time"
                      value={editFields.time}
                      onChange={(e) => setEditFields((f) => ({ ...f, time: e.target.value }))}
                    />
                    <input
                      placeholder="Subject"
                      value={editFields.subject}
                      onChange={(e) => setEditFields((f) => ({ ...f, subject: e.target.value }))}
                    />
                  </div>
                  <div className="routine-segment__edit-row">
                    <input
                      placeholder="Paper"
                      value={editFields.paper}
                      onChange={(e) => setEditFields((f) => ({ ...f, paper: e.target.value }))}
                    />
                    <input
                      placeholder="Chapter"
                      value={editFields.chapter}
                      onChange={(e) => setEditFields((f) => ({ ...f, chapter: e.target.value }))}
                    />
                  </div>
                  <input
                    placeholder="Task"
                    value={editFields.task}
                    onChange={(e) => setEditFields((f) => ({ ...f, task: e.target.value }))}
                  />
                  <div className="routine-segment__edit-actions">
                    <button onClick={saveEdit} className="routine-edit-save">
                      <HiCheck /> Save
                    </button>
                    <button onClick={cancelEdit} className="routine-edit-cancel">
                      <HiX /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="routine-segment__check"
                    onClick={() => onToggle(day._id, seg._id, seg.completed)}
                  >
                    {seg.completed ? (
                      <HiCheckCircle className="check-icon checked" />
                    ) : (
                      <HiOutlineCheckCircle className="check-icon" />
                    )}
                  </div>
                  <div
                    className="routine-segment__info"
                    onClick={() => onToggle(day._id, seg._id, seg.completed)}
                  >
                    <span className="routine-segment__time">
                      {seg.time || (seg.startAt ? new Date(seg.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '')}
                    </span>
                    <span className="routine-segment__subject">
                      {seg.subject}
                      {seg.paper && <span className="routine-segment__paper"> • {seg.paper}</span>}
                      {priority === 'high' && <span className="routine-segment__priority-tag">★ Focus</span>}
                    </span>
                    {seg.chapter && <span className="routine-segment__chapter">📖 {seg.chapter}</span>}
                    {seg.task && <span className="routine-segment__task">{seg.task}</span>}
                  </div>
                  <div className="routine-segment__actions">
                    <button
                      className="routine-segment__focus-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartFocus(seg);
                      }}
                      title="Start focus session (coming soon)"
                    >
                      <HiClock />
                    </button>
                    <button
                      className="routine-segment__edit-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(seg);
                      }}
                      title="Edit segment"
                    >
                      <HiPencil />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}