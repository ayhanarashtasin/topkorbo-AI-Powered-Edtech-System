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
  if (status === 'resolved' || status === 'reviewed') return 'success';
  if (status === 'dismissed') return 'neutral';
  if (status === 'new') return 'warning';
  return 'info';
}

export default function AdminFeedbackDrawer({
  feedback,
  open,
  loading,
  onClose,
  onReview,
  onDismiss,
  onResolve,
  onAddNote
}) {
  return (
    <div className={`admin-drawer ${open ? 'admin-drawer--open' : ''}`}>
      <div className="admin-drawer__backdrop" onClick={onClose} />
      <aside className="admin-drawer__panel admin-drawer__panel--wide">
        <div className="admin-drawer__header">
          <div>
            <p className="admin-topbar__eyebrow">Feedback review</p>
            <h3>{feedback?.itemTitle || 'Feedback details'}</h3>
          </div>
          <AdminActionButton variant="ghost" onClick={onClose}>
            Close
          </AdminActionButton>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <p>Loading feedback details...</p>
          </div>
        ) : !feedback ? (
          <AdminEmptyState compact title="No feedback selected" description="Choose a feedback entry from the table to inspect it." />
        ) : (
          <div className="admin-drawer__content">
            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Feedback summary</h3>
                  <p className="admin-panel__subtext">Review the linked item, user context, and current workflow status.</p>
                </div>
                <div className="admin-chip-row">
                  <AdminBadge tone={toneForStatus(feedback.status)}>{feedback.status}</AdminBadge>
                  <AdminBadge tone="neutral">{feedback.itemType}</AdminBadge>
                  {feedback.rating ? <AdminBadge tone="info">{feedback.rating}/5</AdminBadge> : null}
                </div>
              </div>

              <div className="admin-meta-grid">
                <div><strong>Item</strong><span>{feedback.itemTitle || 'General platform feedback'}</span></div>
                <div><strong>User</strong><span>{feedback.user?.name || 'Anonymous user'}</span></div>
                <div><strong>Email</strong><span>{feedback.user?.email || 'Not provided'}</span></div>
                <div><strong>Role</strong><span>{feedback.user?.role || 'Unknown'}</span></div>
                <div><strong>Created</strong><span>{formatDate(feedback.createdAt)}</span></div>
                <div><strong>Related link</strong><span>{feedback.linkPath || 'No direct link available'}</span></div>
              </div>

              <div className="admin-detail-stack" style={{ marginTop: 16 }}>
                <div>
                  <strong>Message</strong>
                  <p>{feedback.message || 'No feedback message provided.'}</p>
                </div>
              </div>

              <div className="admin-action-row">
                <AdminActionButton tone="info" variant="ghost" onClick={onReview}>
                  Mark reviewed
                </AdminActionButton>
                <AdminActionButton tone="default" variant="ghost" onClick={onDismiss}>
                  Dismiss
                </AdminActionButton>
                <AdminActionButton tone="success" variant="ghost" onClick={onResolve}>
                  Resolve
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
                  <p className="admin-panel__subtext">Internal notes stay inside the feedback workflow.</p>
                </div>
              </div>

              {(feedback.adminNotes || []).length ? (
                <div className="admin-history-list">
                  {feedback.adminNotes.map((note, index) => (
                    <div key={`${note.addedAt || 'note'}-${index}`} className="admin-history-item">
                      <div>
                        <strong>{note.addedBy?.name || 'Admin note'}</strong>
                        <span>{note.note}</span>
                      </div>
                      <time>{formatDate(note.addedAt)}</time>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState compact title="No admin notes yet" description="Add a note if the feedback needs internal context or follow-up." />
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
