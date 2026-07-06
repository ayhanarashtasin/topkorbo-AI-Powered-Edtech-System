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
  if (status === 'resolved') return 'success';
  if (status === 'dismissed') return 'neutral';
  if (status === 'under_review') return 'info';
  if (status === 'open') return 'warning';
  return 'neutral';
}

export default function AdminModerationReportDrawer({
  report,
  open,
  loading,
  onClose,
  onMarkUnderReview,
  onResolve,
  onDismiss,
  onAddNote,
  onWarnUser,
  onHideContent,
  onSuspendUser,
  onBanUser
}) {
  const canHideContent = report?.itemType === 'post' || report?.itemType === 'comment';
  const canModerateUser = Boolean(report?.target?.owner?.id);

  return (
    <div className={`admin-drawer ${open ? 'admin-drawer--open' : ''}`}>
      <div className="admin-drawer__backdrop" onClick={onClose} />
      <aside className="admin-drawer__panel admin-drawer__panel--wide">
        <div className="admin-drawer__header">
          <div>
            <p className="admin-topbar__eyebrow">Moderation details</p>
            <h3>{report?.target?.preview || 'Report details'}</h3>
          </div>
          <AdminActionButton variant="ghost" onClick={onClose}>
            Close
          </AdminActionButton>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <p>Loading report details...</p>
          </div>
        ) : !report ? (
          <AdminEmptyState compact title="No report selected" description="Choose a report from the moderation table to inspect it." />
        ) : (
          <div className="admin-drawer__content">
            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Report summary</h3>
                  <p className="admin-panel__subtext">Review the reported item, linked users, and the current moderation state.</p>
                </div>
                <div className="admin-chip-row">
                  <AdminBadge tone={toneForStatus(report.status)}>{report.status}</AdminBadge>
                  <AdminBadge tone="neutral">{report.itemType}</AdminBadge>
                  <AdminBadge tone="info">{report.reportCount} reports</AdminBadge>
                </div>
              </div>

              <div className="admin-meta-grid">
                <div><strong>Primary reason</strong><span>{report.reason?.replace(/_/g, ' ') || 'N/A'}</span></div>
                <div><strong>Created</strong><span>{formatDate(report.createdAt)}</span></div>
                <div><strong>Reported content</strong><span>{report.target?.preview || 'N/A'}</span></div>
                <div><strong>Target owner</strong><span>{report.target?.owner?.name || 'Not available'}</span></div>
                <div><strong>Owner email</strong><span>{report.target?.owner?.email || 'Not available'}</span></div>
                <div><strong>Related link</strong><span>{report.target?.linkPath || 'No direct link available'}</span></div>
              </div>

              {report.description ? (
                <div className="admin-detail-stack" style={{ marginTop: 16 }}>
                  <div>
                    <strong>Latest description</strong>
                    <p>{report.description}</p>
                  </div>
                </div>
              ) : null}

              <div className="admin-action-row">
                <AdminActionButton tone="info" variant="ghost" onClick={onMarkUnderReview}>
                  Mark under review
                </AdminActionButton>
                <AdminActionButton tone="success" variant="ghost" onClick={onResolve}>
                  Resolve
                </AdminActionButton>
                <AdminActionButton tone="default" variant="ghost" onClick={onDismiss}>
                  Dismiss
                </AdminActionButton>
                <AdminActionButton variant="ghost" onClick={onAddNote}>
                  Add note
                </AdminActionButton>
              </div>

              <div className="admin-action-row">
                <AdminActionButton tone="warning" variant="ghost" onClick={onWarnUser} disabled={!canModerateUser}>
                  Warn user
                </AdminActionButton>
                <AdminActionButton tone="danger" variant="ghost" onClick={onHideContent} disabled={!canHideContent}>
                  Hide content
                </AdminActionButton>
                <AdminActionButton tone="warning" variant="ghost" onClick={onSuspendUser} disabled={!canModerateUser}>
                  Suspend user
                </AdminActionButton>
                <AdminActionButton tone="danger" variant="ghost" onClick={onBanUser} disabled={!canModerateUser}>
                  Ban user
                </AdminActionButton>
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Report history</h3>
                  <p className="admin-panel__subtext">Each submission tied to this reported item is listed here.</p>
                </div>
              </div>

              {(report.reporters || []).length ? (
                <div className="admin-history-list">
                  {report.reporters.map((entry) => (
                    <div key={entry.id} className="admin-history-item">
                      <div>
                        <strong>{entry.reason?.replace(/_/g, ' ') || 'No reason'}</strong>
                        <span>
                          {entry.reportedBy?.name || 'Unknown reporter'} · {entry.reportedBy?.email || 'No email'} · {entry.description || 'No description'}
                        </span>
                      </div>
                      <time>{formatDate(entry.createdAt)}</time>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState compact title="No report history available" description="This report group does not have additional history yet." />
              )}
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Admin notes</h3>
                  <p className="admin-panel__subtext">Internal notes are visible only inside the admin moderation workflow.</p>
                </div>
              </div>

              {(report.adminNotes || []).length ? (
                <div className="admin-history-list">
                  {report.adminNotes.map((entry, index) => (
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
                <AdminEmptyState compact title="No admin notes yet" description="Add a note when you want to preserve reviewer context for future admins." />
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
