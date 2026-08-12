import { useState } from 'react';
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
  onDelete,
  onInlineReply,
  onInlineAddNote
}) {
  const [replyText, setReplyText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [sendingNote, setSendingNote] = useState(false);

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
                  Reply (Modal)
                </AdminActionButton>
                <AdminActionButton variant="ghost" onClick={onAddNote}>
                  Add note (Modal)
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
                <div className="admin-history-list" style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
                  {ticket.replies.map((reply) => (
                    <div key={reply.id} className="admin-history-item" style={{ alignItems: 'flex-start', padding: '12px', border: '1px solid rgba(192, 133, 82, 0.12)', borderRadius: '12px', background: '#fffcf9', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--admin-accent, #c08552)' }}>
                          {reply.author?.name || (reply.authorRole === 'admin' ? 'Admin' : 'User')}
                        </strong>
                        <span style={{ fontSize: '0.94rem', color: '#4a3f35', lineHeight: 1.4 }}>
                          {reply.message}
                        </span>
                      </div>
                      <time style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap', marginLeft: '12px', marginTop: '2px' }}>{formatDate(reply.createdAt)}</time>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState compact title="No replies yet" description="This ticket does not have a reply thread yet." />
              )}

              <div style={{ borderTop: '1px solid rgba(192, 133, 82, 0.12)', paddingTop: '16px', marginTop: '16px' }}>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!replyText.trim() || sendingReply) return;
                    setSendingReply(true);
                    try {
                      await onInlineReply(ticket.id || ticket._id, replyText.trim());
                      setReplyText('');
                    } finally {
                      setSendingReply(false);
                    }
                  }}
                  style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}
                >
                  <label className="admin-field" style={{ flex: 1, margin: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--admin-text-muted)', marginBottom: '6px', display: 'block' }}>Send a reply to the user</span>
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type a message to reply..."
                      disabled={sendingReply}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(192, 133, 82, 0.2)', outline: 'none' }}
                    />
                  </label>
                  <button
                    type="submit"
                    className="admin-button"
                    disabled={!replyText.trim() || sendingReply}
                    style={{ padding: '10px 20px', borderRadius: '12px', background: 'var(--admin-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                  >
                    {sendingReply ? 'Sending...' : 'Send'}
                  </button>
                </form>
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Admin notes</h3>
                  <p className="admin-panel__subtext">Internal notes stay inside the support workflow.</p>
                </div>
              </div>

              {(ticket.adminNotes || []).length ? (
                <div className="admin-history-list" style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' }}>
                  {ticket.adminNotes.map((note, index) => (
                    <div key={`${note.addedAt || 'note'}-${index}`} className="admin-history-item" style={{ alignItems: 'flex-start', padding: '12px', border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '12px', background: '#f8fafc', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <strong style={{ fontSize: '0.88rem', color: '#475569' }}>
                          {note.addedBy?.name || 'Admin Note'}
                        </strong>
                        <span style={{ fontSize: '0.94rem', color: '#334155', lineHeight: 1.4 }}>
                          {note.note}
                        </span>
                      </div>
                      <time style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap', marginLeft: '12px', marginTop: '2px' }}>{formatDate(note.addedAt)}</time>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState compact title="No admin notes yet" description="Add a note if the ticket needs internal handoff context." />
              )}

              <div style={{ borderTop: '1px solid rgba(192, 133, 82, 0.12)', paddingTop: '16px', marginTop: '16px' }}>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!noteText.trim() || sendingNote) return;
                    setSendingNote(true);
                    try {
                      await onInlineAddNote(ticket.id || ticket._id, noteText.trim());
                      setNoteText('');
                    } finally {
                      setSendingNote(false);
                    }
                  }}
                  style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}
                >
                  <label className="admin-field" style={{ flex: 1, margin: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--admin-text-muted)', marginBottom: '6px', display: 'block' }}>Add internal staff note</span>
                    <input
                      type="text"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Type internal notes..."
                      disabled={sendingNote}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(192, 133, 82, 0.2)', outline: 'none' }}
                    />
                  </label>
                  <button
                    type="submit"
                    className="admin-button admin-button--neutral"
                    disabled={!noteText.trim() || sendingNote}
                    style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid rgba(203, 213, 225, 0.95)', background: '#fff', color: 'var(--admin-text)', cursor: 'pointer', fontWeight: 500 }}
                  >
                    {sendingNote ? 'Adding...' : 'Add Note'}
                  </button>
                </form>
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
