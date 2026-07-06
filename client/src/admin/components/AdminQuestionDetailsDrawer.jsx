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
  if (status === 'pending') return 'warning';
  if (status === 'under_review' || status === 'resolved') return 'info';
  return 'neutral';
}

export default function AdminQuestionDetailsDrawer({
  question,
  open,
  loading,
  onClose,
  onApprove,
  onReject,
  onEdit
}) {
  return (
    <div className={`admin-drawer ${open ? 'admin-drawer--open' : ''}`}>
      <div className="admin-drawer__backdrop" onClick={onClose} />
      <aside className="admin-drawer__panel admin-drawer__panel--wide">
        <div className="admin-drawer__header">
          <div>
            <p className="admin-topbar__eyebrow">Question review</p>
            <h3>{question?.preview || 'Question details'}</h3>
          </div>
          <AdminActionButton variant="ghost" onClick={onClose}>
            Close
          </AdminActionButton>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <p>Loading question details...</p>
          </div>
        ) : !question ? (
          <AdminEmptyState compact title="No question selected" description="Choose a question from the table to inspect the full details." />
        ) : (
          <div className="admin-drawer__content">
            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Review summary</h3>
                  <p className="admin-panel__subtext">Approve, reject, or edit question content before it reaches learners.</p>
                </div>
                <div className="admin-chip-row">
                  <AdminBadge tone={toneForStatus(question.status)}>{question.status}</AdminBadge>
                  <AdminBadge tone="neutral">{question.type}</AdminBadge>
                  <AdminBadge tone="info">{question.difficulty || 'medium'}</AdminBadge>
                </div>
              </div>

              <div className="admin-meta-grid">
                <div><strong>Subject</strong><span>{question.subject || 'N/A'}</span></div>
                <div><strong>Paper</strong><span>{question.paper || 'N/A'}</span></div>
                <div><strong>Chapter</strong><span>{question.chapter || 'N/A'}</span></div>
                <div><strong>Topic</strong><span>{question.topic || 'N/A'}</span></div>
                <div><strong>Submitted by</strong><span>{question.submittedBy?.name || 'Unknown teacher'}</span></div>
                <div><strong>Created</strong><span>{formatDate(question.createdAt)}</span></div>
              </div>

              <div className="admin-detail-stack" style={{ marginTop: 16 }}>
                <div>
                  <strong>Question</strong>
                  <p>{question.questionText || 'Not provided'}</p>
                </div>
                {question.imageUrl ? (
                  <div>
                    <strong>Attachment</strong>
                    <a href={question.imageUrl} target="_blank" rel="noreferrer" className="admin-link-button">Open image</a>
                  </div>
                ) : null}
                {Array.isArray(question.options) && question.options.length ? (
                  <div>
                    <strong>Options</strong>
                    <div className="admin-option-list">
                      {question.options.map((option, index) => (
                        <div key={`${option.text}-${index}`} className="admin-option-row">
                          <span>{String.fromCharCode(65 + index)}. {option.text || 'Empty option'}</span>
                          {option.isCorrect ? <AdminBadge tone="success" size="sm">Correct</AdminBadge> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {question.cq?.description ? (
                  <div>
                    <strong>CQ description</strong>
                    <p>{question.cq.description}</p>
                  </div>
                ) : null}
                {Array.isArray(question.cq?.parts) && question.cq.parts.length ? (
                  <div>
                    <strong>CQ parts</strong>
                    <div className="admin-option-list">
                      {question.cq.parts.map((part, index) => (
                        <div key={`${part.label}-${index}`} className="admin-option-row">
                          <span>{part.label || String.fromCharCode(97 + index)}. {part.text || 'Empty part'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div>
                  <strong>Solution / explanation</strong>
                  <p>{question.solution || 'No solution provided.'}</p>
                </div>
                {question.solutionImageUrl ? (
                  <div>
                    <strong>Solution image</strong>
                    <a href={question.solutionImageUrl} target="_blank" rel="noreferrer" className="admin-link-button">Open solution image</a>
                  </div>
                ) : null}
                {question.reviewReason ? (
                  <div>
                    <strong>Admin feedback</strong>
                    <p>{question.reviewReason}</p>
                  </div>
                ) : null}
              </div>

              <div className="admin-action-row">
                <AdminActionButton onClick={onApprove}>Approve</AdminActionButton>
                <AdminActionButton tone="danger" variant="ghost" onClick={onReject}>Reject</AdminActionButton>
                <AdminActionButton tone="info" variant="ghost" onClick={onEdit}>Edit</AdminActionButton>
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Wrong question reports</h3>
                  <p className="admin-panel__subtext">Student and user feedback attached to this question.</p>
                </div>
                <AdminBadge tone="neutral">{question.reports?.length || 0} reports</AdminBadge>
              </div>

              {(question.reports || []).length ? (
                <div className="admin-history-list">
                  {question.reports.map((report) => (
                    <div key={report.id} className="admin-history-item">
                      <div>
                        <strong>{report.reason.replace(/_/g, ' ')}</strong>
                        <span>
                          {report.reportedBy?.name || 'Unknown reporter'} · {report.description || 'No description'}
                        </span>
                      </div>
                      <time>{formatDate(report.createdAt)}</time>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState compact title="No reports yet" description="This question has not been reported through the wrong-question workflow." />
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
