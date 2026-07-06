import AdminActionButton from './AdminActionButton';
import AdminBadge from './AdminBadge';
import AdminEmptyState from './AdminEmptyState';

function formatDate(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function toneForStatus(status) {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

function toAbsoluteAsset(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return `${apiBase.replace('/api', '')}${url}`;
}

export default function AdminIeltsSetDetailsDrawer({
  item,
  open,
  loading,
  onClose,
  onApprove,
  onReject
}) {
  return (
    <div className={`admin-drawer ${open ? 'admin-drawer--open' : ''}`}>
      <div className="admin-drawer__backdrop" onClick={onClose} />
      <aside className="admin-drawer__panel admin-drawer__panel--wide">
        <div className="admin-drawer__header">
          <div>
            <p className="admin-topbar__eyebrow">IELTS set review</p>
            <h3>{item?.title || 'IELTS set details'}</h3>
          </div>
          <AdminActionButton variant="ghost" onClick={onClose}>
            Close
          </AdminActionButton>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <p>Loading IELTS set details...</p>
          </div>
        ) : !item ? (
          <AdminEmptyState compact title="No IELTS set selected" description="Choose a set from the table to inspect its content." />
        ) : (
          <div className="admin-drawer__content">
            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Review summary</h3>
                  <p className="admin-panel__subtext">Approve or reject teacher-submitted IELTS set content before it becomes student-visible.</p>
                </div>
                <div className="admin-chip-row">
                  <AdminBadge tone={toneForStatus(item.status)}>{item.status}</AdminBadge>
                  <AdminBadge tone="info">{item.setTypeLabel}</AdminBadge>
                </div>
              </div>

              <div className="admin-meta-grid">
                <div><strong>Set title</strong><span>{item.title || 'N/A'}</span></div>
                <div><strong>Type</strong><span>{item.setTypeLabel}</span></div>
                <div><strong>Uploader</strong><span>{item.uploader?.name || 'Unknown teacher'}</span></div>
                <div><strong>Email</strong><span>{item.uploader?.email || 'N/A'}</span></div>
                <div><strong>Created</strong><span>{formatDate(item.createdAt)}</span></div>
                <div><strong>Reviewed</strong><span>{formatDate(item.reviewedAt)}</span></div>
              </div>

              {item.rejectionReason ? (
                <div className="admin-detail-stack" style={{ marginTop: 16 }}>
                  <div>
                    <strong>Rejection reason</strong>
                    <p>{item.rejectionReason}</p>
                  </div>
                </div>
              ) : null}

              <div className="admin-action-row">
                <AdminActionButton onClick={onApprove}>Approve</AdminActionButton>
                <AdminActionButton tone="danger" variant="ghost" onClick={onReject}>Reject</AdminActionButton>
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Set content</h3>
                  <p className="admin-panel__subtext">Preview the real uploaded content without changing the teacher workflow.</p>
                </div>
              </div>

              {item.setType === 'listening' ? (
                <div className="admin-history-list">
                  {(item.detail?.sections || []).map((section) => (
                    <div key={section.sectionNumber} className="admin-history-item">
                      <div>
                        <strong>Section {section.sectionNumber}</strong>
                        <span>Audio and PDF assets uploaded for this section.</span>
                      </div>
                      <div className="admin-table__actions">
                        {section.audioUrl ? (
                          <a href={toAbsoluteAsset(section.audioUrl)} target="_blank" rel="noreferrer" className="admin-link-button">
                            Open audio
                          </a>
                        ) : null}
                        {section.pdfUrl ? (
                          <a href={toAbsoluteAsset(section.pdfUrl)} target="_blank" rel="noreferrer" className="admin-link-button">
                            Open PDF
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="admin-detail-stack">
                  {['task1', 'task2'].map((taskKey) => {
                    const task = item.detail?.[taskKey];
                    if (!task) return null;
                    return (
                      <div key={taskKey}>
                        <strong>{taskKey === 'task1' ? 'Task 1' : 'Task 2'}</strong>
                        <p>Input type: {task.type || 'N/A'}</p>
                        {task.textPrompt ? <p>{task.textPrompt}</p> : null}
                        {task.cleanPrompt ? <p>{task.cleanPrompt}</p> : null}
                        <div className="admin-table__actions">
                          {task.pdfUrl ? (
                            <a href={toAbsoluteAsset(task.pdfUrl)} target="_blank" rel="noreferrer" className="admin-link-button">
                              Open PDF
                            </a>
                          ) : null}
                          {task.imageUrl ? (
                            <a href={toAbsoluteAsset(task.imageUrl)} target="_blank" rel="noreferrer" className="admin-link-button">
                              Open image
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
