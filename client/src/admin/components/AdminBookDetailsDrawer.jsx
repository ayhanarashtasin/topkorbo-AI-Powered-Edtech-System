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

function formatBytes(value) {
  const size = Number(value) || 0;
  if (!size) return 'N/A';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function toneForStatus(status) {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

function toneForRagStatus(status) {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  if (['indexing', 'embedding', 'chunking', 'extracting_text'].includes(status)) return 'info';
  if (['pending', 'not_started'].includes(status)) return 'warning';
  return 'neutral';
}

export default function AdminBookDetailsDrawer({
  book,
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
            <p className="admin-topbar__eyebrow">Book approval</p>
            <h3>{book?.title || 'Book details'}</h3>
          </div>
          <AdminActionButton variant="ghost" onClick={onClose}>
            Close
          </AdminActionButton>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <p>Loading book details...</p>
          </div>
        ) : !book ? (
          <AdminEmptyState compact title="No book selected" description="Choose a book from the table to inspect the approval details." />
        ) : (
          <div className="admin-drawer__content">
            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Review summary</h3>
                  <p className="admin-panel__subtext">Approve or reject teacher-uploaded books without affecting Firebase assets or RAG data.</p>
                </div>
                <div className="admin-chip-row">
                  <AdminBadge tone={toneForStatus(book.approvalStatus)}>{book.approvalStatus}</AdminBadge>
                  <AdminBadge tone="neutral">{book.category || 'Uncategorized'}</AdminBadge>
                  <AdminBadge tone={toneForRagStatus(book.rag?.status || book.ragStatus)}>{book.rag?.status || book.ragStatus || 'pending'}</AdminBadge>
                </div>
              </div>

              <div className="admin-meta-grid">
                <div><strong>Subject</strong><span>{book.subject || 'N/A'}</span></div>
                <div><strong>Paper</strong><span>{book.paper || 'N/A'}</span></div>
                <div><strong>Group</strong><span>{book.group || 'N/A'}</span></div>
                <div><strong>Uploader</strong><span>{book.uploadedBy?.name || 'Unknown teacher'}</span></div>
                <div><strong>Uploader email</strong><span>{book.uploadedBy?.email || 'N/A'}</span></div>
                <div><strong>Uploaded</strong><span>{formatDate(book.createdAt)}</span></div>
                <div><strong>Total pages</strong><span>{book.totalPages || 0}</span></div>
                <div><strong>Chapter count</strong><span>{book.chapterCount || 0}</span></div>
                <div><strong>Reviewed</strong><span>{formatDate(book.review?.reviewedAt || book.reviewedAt)}</span></div>
              </div>

              <div className="admin-detail-stack" style={{ marginTop: 16 }}>
                <div>
                  <strong>Description</strong>
                  <p>{book.description || 'No description provided.'}</p>
                </div>
                {book.review?.rejectionReason || book.rejectionReason ? (
                  <div>
                    <strong>Rejection reason</strong>
                    <p>{book.review?.rejectionReason || book.rejectionReason}</p>
                  </div>
                ) : null}
                <div>
                  <strong>Preview PDF</strong>
                  {book.previewUrl || book.previewApiUrl ? (
                    <a href={book.previewUrl || book.previewApiUrl} target="_blank" rel="noreferrer" className="admin-link-button">
                      Open first chapter PDF
                    </a>
                  ) : (
                    <p>No preview chapter is available.</p>
                  )}
                </div>
              </div>

              <div className="admin-action-row">
                <AdminActionButton onClick={onApprove}>Approve</AdminActionButton>
                <AdminActionButton tone="danger" variant="ghost" onClick={onReject}>Reject</AdminActionButton>
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>RAG processing</h3>
                  <p className="admin-panel__subtext">Approval should not delete or invalidate existing book knowledge processing.</p>
                </div>
              </div>

              <div className="admin-meta-grid">
                <div><strong>Status</strong><span>{book.rag?.status || book.ragStatus || 'pending'}</span></div>
                <div><strong>Vector index</strong><span>{book.rag?.vectorIndexStatus || book.vectorIndexStatus || 'not_started'}</span></div>
                <div><strong>Source pages</strong><span>{book.rag?.sourcePages || 0}</span></div>
                <div><strong>Chunks</strong><span>{book.rag?.totalChunks || 0}</span></div>
                <div><strong>Embedded chunks</strong><span>{book.rag?.embeddedChunks || 0}</span></div>
                <div><strong>Completed</strong><span>{formatDate(book.rag?.completedAt)}</span></div>
              </div>

              {book.rag?.message || book.rag?.lastProcessingError ? (
                <div className="admin-detail-stack" style={{ marginTop: 16 }}>
                  {book.rag?.message ? (
                    <div>
                      <strong>RAG message</strong>
                      <p>{book.rag.message}</p>
                    </div>
                  ) : null}
                  {book.rag?.lastProcessingError ? (
                    <div>
                      <strong>Last processing error</strong>
                      <p>{book.rag.lastProcessingError}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Chapter assets</h3>
                  <p className="admin-panel__subtext">Each chapter keeps its original Firebase-backed PDF link intact.</p>
                </div>
              </div>

              {(book.chapters || []).length ? (
                <div className="admin-history-list">
                  {book.chapters.map((chapter) => (
                    <div key={chapter.id} className="admin-history-item">
                      <div>
                        <strong>{chapter.title}</strong>
                        <span>
                          Order {chapter.order + 1} · {chapter.pageCount || 0} pages · {formatBytes(chapter.fileSize)}
                        </span>
                      </div>
                      <a href={chapter.previewUrl || chapter.previewApiUrl} target="_blank" rel="noreferrer" className="admin-link-button">
                        Open PDF
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState compact title="No chapters found" description="This book does not currently expose any chapters for preview." />
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
