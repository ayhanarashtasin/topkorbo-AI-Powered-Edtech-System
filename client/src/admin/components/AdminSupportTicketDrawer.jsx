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
  if (status === 'closed') return 'neutral';
  if (status === 'in_progress') return 'info';
  if (status === 'open') return 'warning';
  return 'neutral';
}

function toneForPriority(priority) {
  if (priority === 'urgent') return 'danger';
  if (priority === 'high') return 'warning';
  if (priority === 'normal') return 'info';
  return 'neutral';
}

export default function AdminSupportTicketDrawer({
  ticket,
  open,
  loading,
  onClose,
  onUpdateStatus,
  onUpdatePriority,
  onReply,
  onAddNote,
  onDelete
}) {
  return (
    <div className={`admin-drawer ${open ? 'admin-drawer--open' : ''}`}>
      <div className="admin-drawer__backdrop" onClick={onClose} />
      <aside className="admin-drawer__panel admin-drawer__panel--wide">
        <div className="admin-drawer__header">
          <div>
            <p className="admin-topbar__eyebrow">Support ticket</p>
            <h3>{ticket?.title || 'Ticket details'}</h3>
          </div>
          <AdminActionButton variant="ghost" onClick={onClose}>
            Close
          </AdminActionButton>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <p>Loading ticket details...</p>
          </div>
        ) : !ticket ? (
          <AdminEmptyState compact title="No ticket selected" description="Choose a support ticket from the table to inspect it." />
        ) : (
          <div className="admin-drawer__content">
            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Ticket summary</h3>
                  <p className="admin-panel__subtext">Review the request, current state, and user context before responding.</p>
                </div>
                <div className="admin-chip-row">
                  <AdminBadge tone={toneForStatus(ticket.status)}>{ticket.status}</AdminBadge>
                  <AdminBadge tone={toneForPriority(ticket.priority)}>{ticket.priority}</AdminBadge>
                  <AdminBadge tone="neutral">{ticket.category}</AdminBadge>
                </div>
              </div>

              <div className="admin-meta-grid">
                <div><strong>User</strong><span>{ticket.user?.name || 'Anonymous user'}</span></div>
                <div><strong>Email</strong><span>{ticket.user?.email || 'Not provided'}</span></div>
                <div><strong>Role</strong><span>{ticket.user?.role || 'Unknown'}</span></div>
                <div><strong>Created</strong><span>{formatDate(ticket.createdAt)}</span></div>
                <div><strong>Updated</strong><span>{formatDate(ticket.updatedAt)}</span></div>
              </div>

              <div className="admin-detail-stack" style={{ marginTop: 16 }}>
                <div>
                  <strong>Message</strong>
                  <p>{ticket.message || 'No ticket message provided.'}</p>
                </div>
              </div>

              <div className="admin-action-row">
                <AdminActionButton tone="info" variant="ghost" onClick={onUpdateStatus}>
                  Update status
                </AdminActionButton>
                <AdminActionButton tone="warning" variant="ghost" onClick={onUpdatePriority}>
                  Change priority
                </AdminActionButton>
                <AdminActionButton tone="success" variant="ghost" onClick={onReply}>
                  Reply
                </AdminActionButton>
                <AdminActionButton variant="ghost" onClick={onAddNote}>
                  Add note
                </AdminActionButton>
                <AdminActionButton tone="danger" variant="ghost" onClick={onDelete}>
                  Delete Ticket
                </AdminActionButton>
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Conversation</h3>
                  <p className="admin-panel__subtext">Replies recorded for this ticket appear here.</p>
                </div>
              </div>

              {(ticket.replies || []).length ? (
                <div className="admin-history-list">
                  {ticket.replies.map((reply) => (
                    <div key={reply.id} className="admin-history-item">
                      <div>
                        <strong>{reply.author?.name || (reply.authorRole === 'admin' ? 'Admin' : 'User')}</strong>
                        <span>{reply.message}</span>
                      </div>
                      <time>{formatDate(reply.createdAt)}</time>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState compact title="No replies yet" description="This ticket does not have a reply thread yet." />
              )}
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Admin notes</h3>
                  <p className="admin-panel__subtext">Internal notes stay inside the support workflow.</p>
                </div>
              </div>

              {(ticket.adminNotes || []).length ? (
                <div className="admin-history-list">
                  {ticket.adminNotes.map((note, index) => (
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
                <AdminEmptyState compact title="No admin notes yet" description="Add a note if the ticket needs internal handoff context." />
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
