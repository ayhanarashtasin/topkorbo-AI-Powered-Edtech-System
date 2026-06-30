import React from 'react';
import { HiFire, HiAcademicCap } from 'react-icons/hi';

export default function StatsBar({ stats, routine, examDate, isExpired }) {
  const pct = stats?.overallCompletionPct ?? 0;
  const streak = stats?.streakDays ?? 0;
  const subjects = stats?.bySubject || {};

  const examCountdown = (() => {
    if (!examDate) return null;
    const d = new Date(examDate);
    const now = new Date();
    const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    if (diff > 0) return `${diff} day${diff === 1 ? '' : 's'} until exam`;
    if (diff === 0) return 'Exam today';
    return null;
  })();

  const totalCompleted = routine?.routine?.reduce(
    (acc, d) => acc + (Array.isArray(d.segments) ? d.segments.filter((s) => s.completed).length : 0), 0
  ) || 0;
  const totalSegments = routine?.routine?.reduce(
    (acc, d) => acc + (Array.isArray(d.segments) ? d.segments.length : 0), 0
  ) || 0;

  return (
    <div className="routine-stats-bar">
      {/* Streak chip */}
      <div className={`routine-streak-chip ${streak > 0 ? 'routine-streak-chip--on' : ''}`}>
        <HiFire />
        <div className="routine-streak-chip__body">
          <span className="routine-streak-chip__num">{streak}</span>
          <span className="routine-streak-chip__label">day streak</span>
        </div>
      </div>

      {/* Overall progress ring */}
      <div className="routine-overall-progress">
        <div className="routine-overall-progress__ring">
          <svg viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="rgba(31,122,109,0.15)"
              strokeWidth="3"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#1f7a6d"
              strokeWidth="3"
              strokeDasharray={`${pct}, 100`}
              strokeLinecap="round"
            />
          </svg>
          <span className="routine-overall-progress__text">{pct}%</span>
        </div>
        <div className="routine-overall-progress__label">
          <strong>{totalCompleted}</strong>
          {' / '}
          {totalSegments} done
        </div>
      </div>

      {/* Subject chips */}
      <div className="routine-subject-chips">
        <HiAcademicCap className="routine-subject-chips__icon" />
        {Object.keys(subjects).slice(0, 6).map((subj) => {
          const s = subjects[subj];
          return (
            <span key={subj} className="routine-subject-chip" title={`${subj}: ${s.done}/${s.planned} done`}>
              <span className="routine-subject-chip__name">{subj}</span>
              <span className="routine-subject-chip__pct">{s.pct}%</span>
            </span>
          );
        })}
        {Object.keys(subjects).length === 0 && (
          <span className="routine-subject-chip routine-subject-chip--empty">No subjects yet</span>
        )}
      </div>

      {/* Exam countdown or expired badge */}
      {isExpired ? (
        <div className="routine-exam-countdown routine-exam-countdown--expired">
          Exam date passed
        </div>
      ) : examCountdown ? (
        <div className="routine-exam-countdown">
          {examCountdown}
        </div>
      ) : null}
    </div>
  );
}