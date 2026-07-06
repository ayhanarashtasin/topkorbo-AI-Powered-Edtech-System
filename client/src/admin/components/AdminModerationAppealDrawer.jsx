import AdminActionButton from './AdminActionButton';
import AdminBadge from './AdminBadge';
import AdminEmptyState from './AdminEmptyState';

function formatDate(value) {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function toneForStatus(status) {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'under_review') return 'info';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

export default function AdminModerationAppealDrawer({
  appeal,
  open,
  loading,
  onClose,
  onApprove,
  onReject,
  onAddNote
}) {
  return (
    <div className={`admin-drawer ${open ? 'admin-drawer--open' : ''}`}>
      <div className="admin-drawer__backdrop" onClick={onClose} />
      <aside className="admin-drawer__panel admin-drawer__panel--wide">
        <div className="admin-drawer__header">
          <div>
            <p className="admin-topbar__eyebrow">Appeal details</p>
            <h3>{appeal?.user?.name || 'Appeal review'}</h3>
          </div>
          <AdminActionButton variant="ghost" onClick={onClose}>
            Close
          </AdminActionButton>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <p>Loading appeal details...</p>
          </div>
        ) : !appeal ? (
          <AdminEmptyState compact title="No appeal selected" description="Choose an appeal from the list to inspect it." />
        ) : (
          <div className="admin-drawer__content">
            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Appeal summary</h3>
                  <p className="admin-panel__subtext">Review the appeal reason and the current account state before reactivating access.</p>
                </div>
                <div className="admin-chip-row">
                  <AdminBadge tone={toneForStatus(appeal.status)}>{appeal.status}</AdminBadge>
                  <AdminBadge tone="neutral">{appeal.user?.accountStatus || appeal.accountStatusAtSubmission}</AdminBadge>
                </div>
              </div>

              <div className="admin-meta-grid">
                <div><strong>User</strong><span>{appeal.user?.name || 'Unknown user'}</span></div>
                <div><strong>Email</strong><span>{appeal.user?.email || 'N/A'}</span></div>
                <div><strong>Current status</strong><span>{appeal.user?.accountStatus || 'N/A'}</span></div>
                <div><strong>Status at submission</strong><span>{appeal.accountStatusAtSubmission || 'N/A'}</span></div>
                <div><strong>Submitted</strong><span>{formatDate(appeal.submittedAt)}</span></div>
                <div><strong>Last reviewed</strong><span>{formatDate(appeal.reviewedAt)}</span></div>
              </div>

              <div className="admin-detail-stack" style={{ marginTop: 16 }}>
                <div>
                  <strong>Appeal reason</strong>
                  <p>{appeal.reason || 'No appeal reason provided.'}</p>
                </div>
                {appeal.user?.statusReason ? (
                  <div>
                    <strong>Current restriction reason</strong>
                    <p>{appeal.user.statusReason}</p>
                  </div>
                ) : null}
              </div>

              <div className="admin-action-row">
                <AdminActionButton tone="success" onClick={onApprove}>
                  Approve appeal
                </AdminActionButton>
                <AdminActionButton tone="danger" variant="ghost" onClick={onReject}>
                  Reject appeal
                </AdminActionButton>
                <AdminActionButton variant="ghost" onClick={onAddNote}>
                  Add note
                </AdminActionButton>
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Admin notes</h3>
                  <p className="admin-panel__subtext">Keep internal reasoning attached to the appeal for later review.</p>
                </div>
              </div>

              {(appeal.adminNotes || []).length ? (
                <div className="admin-history-list">
                  {appeal.adminNotes.map((entry, index) => (
                    <div key={`${entry.addedAt || 'note'}-${index}`} className="admin-history-item">
                      <div>
                        <strong>{entry.addedBy?.name || 'Admin note'}</strong>
                        <span>{entry.note}</span>
                      </div>
                      <time>{formatDate(entry.addedAt)}</time>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState compact title="No appeal notes yet" description="Add a note when you want to preserve context for future admins." />
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
