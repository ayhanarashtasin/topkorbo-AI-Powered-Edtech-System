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

function formatDuration(duration) {
  const hours = Number(duration?.hours) || 0;
  const minutes = Number(duration?.minutes) || 0;
  return `${hours}h ${minutes}m`;
}

function toneForAdminStatus(status) {
  if (status === 'active') return 'success';
  if (status === 'archived') return 'neutral';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

function toneForLifecycle(status) {
  if (status === 'live') return 'success';
  if (status === 'upcoming') return 'info';
  if (status === 'completed') return 'neutral';
  if (status === 'archived') return 'neutral';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

function formatRank(rank) {
  return typeof rank === 'number' ? `#${rank}` : String(rank || 'N/A');
}

export default function AdminContestDetailsDrawer({
  contest,
  open,
  loading,
  onClose,
  onSetStatus,
  onEdit
}) {
  return (
    <div className={`admin-drawer ${open ? 'admin-drawer--open' : ''}`}>
      <div className="admin-drawer__backdrop" onClick={onClose} />
      <aside className="admin-drawer__panel admin-drawer__panel--wide">
        <div className="admin-drawer__header">
          <div>
            <p className="admin-topbar__eyebrow">Contest control</p>
            <h3>{contest?.name || 'Contest details'}</h3>
          </div>
          <AdminActionButton variant="ghost" onClick={onClose}>
            Close
          </AdminActionButton>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <p>Loading contest details...</p>
          </div>
        ) : !contest ? (
          <AdminEmptyState compact title="No contest selected" description="Choose a contest from the table to inspect schedule, registrations, and current admin controls." />
        ) : (
          <div className="admin-drawer__content">
            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Contest summary</h3>
                  <p className="admin-panel__subtext">Control visibility, cancellation, and timing without touching Phase 7B live monitoring work.</p>
                </div>
                <div className="admin-chip-row">
                  <AdminBadge tone={toneForAdminStatus(contest.adminStatus)}>{contest.adminStatus}</AdminBadge>
                  <AdminBadge tone={toneForLifecycle(contest.lifecycle)}>{contest.lifecycle}</AdminBadge>
                  <AdminBadge tone="neutral">{contest.questionType || 'N/A'}</AdminBadge>
                </div>
              </div>

                <div className="admin-meta-grid">
                <div><strong>Creator</strong><span>{contest.creator?.name || 'Unknown teacher'}</span></div>
                <div><strong>Creator email</strong><span>{contest.creator?.email || 'N/A'}</span></div>
                <div><strong>Level</strong><span>{contest.level || 'N/A'}</span></div>
                <div><strong>Schedule start</strong><span>{formatDateTime(contest.startDate)}</span></div>
                <div><strong>Schedule end</strong><span>{formatDateTime(contest.endDate)}</span></div>
                <div><strong>Duration</strong><span>{formatDuration(contest.duration)}</span></div>
                <div><strong>Questions</strong><span>{contest.questionCount || 0}</span></div>
                <div><strong>Registrations</strong><span>{contest.registrationCount || 0}</span></div>
                <div><strong>Results</strong><span>{contest.resultCount || 0}</span></div>
                <div><strong>Created</strong><span>{formatDateTime(contest.createdAt)}</span></div>
                <div><strong>Updated</strong><span>{formatDateTime(contest.updatedAt)}</span></div>
              </div>

              <div className="admin-detail-stack" style={{ marginTop: 16 }}>
                <div>
                  <strong>Coverage</strong>
                  <p>
                    {contest.level === 'admission'
                      ? [contest.admissionType, contest.admissionSubtype].filter(Boolean).join(' / ') || 'Admission'
                      : (contest.subjects || []).join(', ') || 'No subjects recorded.'}
                  </p>
                </div>
                {contest.review?.adminStatusReason ? (
                  <div>
                    <strong>Latest admin note</strong>
                    <p>{contest.review.adminStatusReason}</p>
                  </div>
                ) : null}
                <div>
                  <strong>Description / instructions</strong>
                  <p>The current contest schema does not store separate description or rules fields.</p>
                </div>
              </div>

              <div className="admin-action-row">
                {contest.adminStatus !== 'active' ? (
                  <AdminActionButton onClick={() => onSetStatus('active')}>Restore</AdminActionButton>
                ) : null}
                <AdminActionButton variant="ghost" onClick={onEdit}>Edit</AdminActionButton>
                {contest.adminStatus !== 'archived' ? (
                  <AdminActionButton variant="ghost" onClick={() => onSetStatus('archived')}>Archive</AdminActionButton>
                ) : null}
                {contest.adminStatus !== 'cancelled' ? (
                  <AdminActionButton tone="danger" variant="ghost" onClick={() => onSetStatus('cancelled')}>Cancel contest</AdminActionButton>
                ) : null}
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Leaderboard snapshot</h3>
                  <p className="admin-panel__subtext">A lightweight standings view for operational checks only, without Phase 7B live controls.</p>
                </div>
              </div>

              {(contest.topResults || []).length ? (
                <div className="admin-history-list">
                  {contest.topResults.map((entry) => (
                    <div key={entry.id} className="admin-history-item">
                      <div>
                        <strong>{entry.student?.name || 'Unknown student'} • {formatRank(entry.rank)}</strong>
                        <span>
                          {entry.score}/{entry.totalQuestions} score • {entry.answersSubmitted} submitted • {Math.round((entry.timeTakenSeconds || 0) / 60)} min
                        </span>
                        {entry.isDisqualified && entry.disqualificationReason ? (
                          <span>Disqualified: {entry.disqualificationReason}</span>
                        ) : null}
                      </div>
                      <span className="admin-table__muted">{formatDateTime(entry.submittedAt)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState compact title="No submissions yet" description="Contest results will appear here once students start or finish attempts." />
              )}
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Registered students</h3>
                  <p className="admin-panel__subtext">Registration details stay intact even when a contest is archived or cancelled.</p>
                </div>
              </div>

              {(contest.registeredStudentsDetails || []).length ? (
                <div className="admin-history-list">
                  {contest.registeredStudentsDetails.map((entry) => (
                    <div key={`${entry.studentId}-${entry.registeredAt || entry.email}`} className="admin-history-item">
                      <div>
                        <strong>{entry.name || 'Unnamed student'}</strong>
                        <span>{[entry.email, entry.phoneNumber, entry.collegeName, entry.hscBatch].filter(Boolean).join(' • ') || 'No registration details provided'}</span>
                      </div>
                      <span className="admin-table__muted">{formatDateTime(entry.registeredAt)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState compact title="No registrations yet" description="Registered student information will appear once learners sign up for this contest." />
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
