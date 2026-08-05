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

function statusTone(status) {
  if (status === 'approved' || status === 'verified') return 'success';
  if (status === 'rejected' || status === 'banned') return 'danger';
  if (status === 'pending') return 'warning';
  if (status === 'under_review' || status === 'more_info_requested') return 'info';
  return 'neutral';
}

export default function AdminTeacherDetailsDrawer({
  teacher,
  open,
  loading,
  onClose,
  onApplicationAction,
  onVerificationAction
}) {
  return (
    <div className={`admin-drawer ${open ? 'admin-drawer--open' : ''}`}>
      <div className="admin-drawer__backdrop" onClick={onClose} />
      <aside className="admin-drawer__panel admin-drawer__panel--wide">
        <div className="admin-drawer__header">
          <div>
            <p className="admin-topbar__eyebrow">Teacher review</p>
            <h3>{teacher?.profile?.name || 'Teacher details'}</h3>
          </div>
          <AdminActionButton variant="ghost" onClick={onClose}>
            Close
          </AdminActionButton>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <p>Loading teacher details...</p>
          </div>
        ) : !teacher ? (
          <AdminEmptyState
            compact
            title="No teacher selected"
            description="Choose an application or teacher record to review the details."
          />
        ) : (
          <div className="admin-drawer__content">
            <section className="admin-panel">
              <div className="admin-profile-chip admin-profile-chip--wide">
                <div className="admin-avatar">{teacher.profile?.name?.charAt(0)?.toUpperCase() || 'T'}</div>
                <div>
                  <strong>{teacher.profile?.name || 'Unknown teacher'}</strong>
                  <p>{teacher.profile?.email || 'No email'}</p>
                </div>
              </div>
              <div className="admin-meta-grid">
                <div><strong>Role</strong><span>{teacher.profile?.role || 'tutor'}</span></div>
                <div><strong>Phone</strong><span>{teacher.profile?.phoneNumber || 'Not provided'}</span></div>
                <div><strong>Joined</strong><span>{formatDate(teacher.profile?.joinedDate)}</span></div>
                <div><strong>University</strong><span>{teacher.profile?.universityName || 'Not provided'}</span></div>
                <div><strong>Department</strong><span>{teacher.profile?.department || 'Not provided'}</span></div>
                <div><strong>Semester</strong><span>{teacher.profile?.currentYearSemester || 'Not provided'}</span></div>
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Application review</h3>
                  <p className="admin-panel__subtext">Approve, reject, or request clarification from the applicant.</p>
                </div>
                <AdminBadge tone={statusTone(teacher.application?.status || 'pending')}>
                  {teacher.application?.status || 'Not submitted'}
                </AdminBadge>
              </div>

              {teacher.application ? (
                <>
                  <div className="admin-detail-stack">
                    <div>
                      <strong>About the teacher</strong>
                      <p>{teacher.application.aboutYou || 'Not provided'}</p>
                    </div>
                    <div>
                      <strong>Requested categories</strong>
                      <div className="admin-chip-row">
                        {(teacher.application.requestedCategories || []).length ? (
                          teacher.application.requestedCategories.map((item) => (
                            <AdminBadge key={item} tone="neutral" size="sm">{item}</AdminBadge>
                          ))
                        ) : (
                          <span className="admin-inline-note">No categories were submitted.</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <strong>Admin note</strong>
                      <p>{teacher.application.adminNote || 'No admin note yet.'}</p>
                    </div>
                    <div>
                      <strong>Review reason</strong>
                      <p>{teacher.application.reviewReason || 'No reason recorded.'}</p>
                    </div>
                  </div>

                  <div className="admin-action-row">
                    <AdminActionButton onClick={() => onApplicationAction('approved')}>
                      Approve
                    </AdminActionButton>
                    <AdminActionButton tone="info" variant="ghost" onClick={() => onApplicationAction('under_review')}>
                      Mark under review
                    </AdminActionButton>
                    <AdminActionButton tone="warning" variant="ghost" onClick={() => onApplicationAction('more_info_requested')}>
                      Request more info
                    </AdminActionButton>
                    <AdminActionButton tone="danger" variant="ghost" onClick={() => onApplicationAction('rejected')}>
                      Reject
                    </AdminActionButton>
                  </div>

                  {(teacher.application.reviewHistory || []).length ? (
                    <div className="admin-history-list">
                      <h4>Review history</h4>
                      {(teacher.application.reviewHistory || []).slice().reverse().map((item, index) => (
                        <div className="admin-history-item" key={`${item.actedAt || index}-${index}`}>
                          <div>
                            <strong>{item.action.replace(/_/g, ' ')}</strong>
                            <span>{item.note || 'No note recorded.'}</span>
                          </div>
                          <time>{formatDate(item.actedAt)}</time>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <AdminEmptyState compact title="No application found" description="This user has not submitted a teacher application yet." />
              )}
            </section>

            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h3>Verification review</h3>
                  <p className="admin-panel__subtext">Private documents and verification data stay visible only to admins.</p>
                </div>
                <AdminBadge tone={statusTone(teacher.verification?.status || 'unverified')}>
                  {teacher.verification?.status || 'unverified'}
                </AdminBadge>
              </div>

              <div className="admin-meta-grid">
                <div><strong>Student ID</strong><span>{teacher.verification?.fields?.studentIdNumber || 'Not provided'}</span></div>
                <div><strong>IELTS score</strong><span>{teacher.verification?.fields?.ieltsScore || 'Not provided'}</span></div>
                <div><strong>University</strong><span>{teacher.verification?.fields?.universityName || 'Not provided'}</span></div>
                <div><strong>Department</strong><span>{teacher.verification?.fields?.department || 'Not provided'}</span></div>
                <div><strong>DOB</strong><span>{teacher.verification?.fields?.dob ? formatDate(teacher.verification.fields.dob) : 'Not provided'}</span></div>
                <div><strong>Gender</strong><span>{teacher.verification?.fields?.gender || 'Not provided'}</span></div>
              </div>

              <div className="admin-document-grid">
                {(teacher.verification?.documents || []).map((document) => (
                  <article key={document.key} className="admin-document-card">
                    <div>
                      <strong>{document.label}</strong>
                      <p>{document.provided ? 'Available to review' : 'Not provided'}</p>
                    </div>
                    {document.provided ? (
                      <a href={document.url} target="_blank" rel="noreferrer" className="admin-link-button">
                        Open
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>

              <div className="admin-action-row">
                <AdminActionButton tone="warning" variant="ghost" onClick={() => onVerificationAction('pending')}>
                  Mark pending
                </AdminActionButton>
                <AdminActionButton tone="success" onClick={() => onVerificationAction('verified')}>
                  Verify
                </AdminActionButton>
                <AdminActionButton tone="danger" variant="ghost" onClick={() => onVerificationAction('rejected')}>
                  Reject verification
                </AdminActionButton>
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
