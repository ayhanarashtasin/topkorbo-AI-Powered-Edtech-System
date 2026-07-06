import { useState } from 'react';
import AdminActionButton from './AdminActionButton';
import AdminBadge from './AdminBadge';
import AdminEmptyState from './AdminEmptyState';

function formatDateTime(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function toneForFlag(status) {
  if (status === 'flagged') return 'warning';
  if (status === 'cleared') return 'success';
  return 'neutral';
}

export default function AdminContestAttemptDrawer({
  attempt,
  open,
  loading,
  onClose,
  onFlag,
  onClear,
  onSaveNote
}) {
  const [note, setNote] = useState('');

  return (
    <div className={`admin-drawer ${open ? 'admin-drawer--open' : ''}`}>
      <div className="admin-drawer__backdrop" onClick={onClose} />
      <aside className="admin-drawer__panel admin-drawer__panel--wide">
        <div className="admin-drawer__header">
          <div>
            <p className="admin-topbar__eyebrow">Anti-Cheat Review</p>
            <h3>{attempt?.contest?.title || 'Attempt details'}</h3>
          </div>
          <AdminActionButton variant="ghost" onClick={onClose}>Close</AdminActionButton>
        </div>

        {loading ? (
          <div className="admin-empty-state"><p>Loading attempt details...</p></div>
        ) : !attempt ? (
          <AdminEmptyState compact title="No attempt selected" description="Choose an attempt from live monitoring or anti-cheat review to inspect its signals." />
        ) : (
          <div className="admin-drawer__content">
            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Attempt summary</h3>
                  <p className="admin-panel__subtext">This review layer is non-destructive and does not invalidate leaderboard history in Phase 7B.</p>
                </div>
                <div className="admin-chip-row">
                  <AdminBadge tone={toneForFlag(attempt.antiCheatStatus)}>{attempt.antiCheatStatus}</AdminBadge>
                  {attempt.isDisqualified ? <AdminBadge tone="danger">disqualified</AdminBadge> : null}
                </div>
              </div>

              <div className="admin-meta-grid">
                <div><strong>User</strong><span>{attempt.user?.name || 'Unknown user'}</span></div>
                <div><strong>Email</strong><span>{attempt.user?.email || 'N/A'}</span></div>
                <div><strong>Contest</strong><span>{attempt.contest?.title || 'N/A'}</span></div>
                <div><strong>Score</strong><span>{attempt.score} / {attempt.totalQuestions}</span></div>
                <div><strong>Answers submitted</strong><span>{attempt.answersSubmitted || 0}</span></div>
                <div><strong>Duration</strong><span>{attempt.durationSeconds || 0}s</span></div>
                <div><strong>Started</strong><span>{formatDateTime(attempt.startedAt)}</span></div>
                <div><strong>Submitted</strong><span>{formatDateTime(attempt.submittedAt)}</span></div>
                <div><strong>Flagged at</strong><span>{formatDateTime(attempt.antiCheatFlaggedAt)}</span></div>
                <div><strong>Reviewed at</strong><span>{formatDateTime(attempt.antiCheatReviewedAt)}</span></div>
              </div>

              {attempt.disqualificationReason ? (
                <div className="admin-detail-stack" style={{ marginTop: 16 }}>
                  <div>
                    <strong>Client disqualification reason</strong>
                    <p>{attempt.disqualificationReason}</p>
                  </div>
                </div>
              ) : null}

              <div className="admin-action-row">
                <AdminActionButton onClick={() => onFlag(attempt.id)}>Flag suspicious</AdminActionButton>
                <AdminActionButton variant="ghost" onClick={() => onClear(attempt.id)}>Clear flag</AdminActionButton>
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Detected signals</h3>
                  <p className="admin-panel__subtext">Only signals supported by the current contest and practice-attempt data are shown.</p>
                </div>
              </div>
              {(attempt.suspiciousSignals || []).length ? (
                <div className="admin-history-list">
                  {attempt.suspiciousSignals.map((signal) => (
                    <div key={signal.code} className="admin-history-item">
                      <div>
                        <strong>{signal.label}</strong>
                        <span>{signal.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState compact title="No rule-based signals" description="This attempt does not currently match the Phase 7B anti-cheat rules." />
              )}
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Review note</h3>
                  <p className="admin-panel__subtext">Store an admin note without changing the attempt outcome.</p>
                </div>
              </div>

              <label className="admin-field">
                <span>Note</span>
                <textarea
                  rows={4}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={attempt.antiCheatReviewNote || 'Add review note'}
                />
              </label>
              <div className="admin-action-row">
                <AdminActionButton onClick={() => onSaveNote(attempt.id, note.trim())}>Save note</AdminActionButton>
              </div>
              {attempt.antiCheatReviewNote ? (
                <div className="admin-detail-stack" style={{ marginTop: 16 }}>
                  <div>
                    <strong>Current note</strong>
                    <p>{attempt.antiCheatReviewNote}</p>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Attempt detail</h3>
                  <p className="admin-panel__subtext">Contest answers and practice-attempt detail are shown only when the current project already stores them.</p>
                </div>
              </div>

              {attempt.practiceAttempt?.questions?.length ? (
                <div className="admin-history-list">
                  {attempt.practiceAttempt.questions.slice(0, 25).map((question) => (
                    <div key={question.id} className="admin-history-item">
                      <div>
                        <strong>{question.subject || 'Question'} • {question.chapter || 'General'} • {question.topic || 'General'}</strong>
                        <span>{question.questionText || 'Question text unavailable'}</span>
                        <span>
                          Attempted: {question.isAttempted ? 'yes' : 'no'} • Correct: {String(question.isCorrect)} • Time: {question.timeSpentSeconds || 0}s
                        </span>
                        {question.aiFeedback ? <span>{question.aiFeedback}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState compact title="No stored per-question review data" description="This project stores full question detail only when a linked practice attempt exists." />
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
