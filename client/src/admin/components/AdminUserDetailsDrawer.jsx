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
  if (status === 'active') return 'success';
  if (status === 'suspended') return 'warning';
  if (status === 'banned') return 'danger';
  return 'neutral';
}

function toneForRole(role) {
  if (role === 'admin') return 'danger';
  if (role === 'moderator') return 'info';
  if (role === 'teacher') return 'success';
  if (role === 'tutor') return 'warning';
  return 'neutral';
}

export default function AdminUserDetailsDrawer({ user, open, loading, onClose, onLiveSessionReset }) {
  const canResetLiveSessions = ['tutor', 'teacher'].includes(user?.baseRole || user?.role);

  return (
    <div className={`admin-drawer ${open ? 'admin-drawer--open' : ''}`}>
      <div className="admin-drawer__backdrop" onClick={onClose} />
      <aside className="admin-drawer__panel">
        <div className="admin-drawer__header">
          <div>
            <p className="admin-topbar__eyebrow">User details</p>
            <h3>{user?.name || 'User profile'}</h3>
          </div>
          <AdminActionButton variant="ghost" onClick={onClose}>
            Close
          </AdminActionButton>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <p>Loading user details...</p>
          </div>
        ) : user ? (
          <div className="admin-drawer__content">
            <section className="admin-panel">
              <div className="admin-profile-chip admin-profile-chip--wide">
                <div className="admin-avatar">{user.name?.charAt(0)?.toUpperCase() || 'U'}</div>
                <div>
                  <strong>{user.name}</strong>
                  <p>{user.email}</p>
                </div>
              </div>
              <div className="admin-chip-row">
                <AdminBadge tone={toneForRole(user.role)}>{user.role}</AdminBadge>
                <AdminBadge tone={toneForStatus(user.accountStatus)}>{user.accountStatus}</AdminBadge>
                <AdminBadge tone="neutral">{user.plan || 'free'} plan</AdminBadge>
              </div>
              <div className="admin-meta-grid">
                <div><strong>Phone</strong><span>{user.phoneNumber || 'N/A'}</span></div>
                <div><strong>Joined</strong><span>{formatDate(user.joinedDate)}</span></div>
                <div><strong>Last active</strong><span>{formatDate(user.lastActiveAt)}</span></div>
                <div><strong>Reputation</strong><span>{user.reputation ?? 0}</span></div>
                <div><strong>Warnings</strong><span>{user.warningsCount ?? 0}</span></div>
                <div><strong>Role source</strong><span>{user.baseRole || user.role}</span></div>
              </div>
            </section>

            {canResetLiveSessions ? (
              <section className="admin-panel">
                <div className="admin-panel__header">
                  <div>
                    <h3>Mentor panel live class quota</h3>
                    <p className="admin-panel__subtext">Reset this mentor's weekly live-class count when they need a manual bypass.</p>
                  </div>
                  <AdminBadge tone="info">
                    {user.liveClassUsage?.sessionsThisWeek ?? 0} / {user.liveClassUsage?.weeklyLimit ?? 4}
                  </AdminBadge>
                </div>

                <div className="admin-meta-grid">
                  <div><strong>Week starts</strong><span>{formatDate(user.liveClassUsage?.weekStart)}</span></div>
                  <div><strong>Last reset</strong><span>{formatDate(user.liveClassUsage?.resetAt)}</span></div>
                </div>

                <div className="admin-action-row">
                  <AdminActionButton tone="warning" variant="ghost" onClick={onLiveSessionReset}>
                    Reset mentor sessions to 0
                  </AdminActionButton>
                </div>
              </section>
            ) : null}

            <section className="admin-panel">
              <h3>Academic and related info</h3>
              <div className="admin-meta-grid">
                <div><strong>College</strong><span>{user.collegeName || 'N/A'}</span></div>
                <div><strong>HSC batch</strong><span>{user.hscBatch || 'N/A'}</span></div>
                <div><strong>University</strong><span>{user.universityName || 'N/A'}</span></div>
                <div><strong>Department</strong><span>{user.department || 'N/A'}</span></div>
                <div><strong>District</strong><span>{user.district || 'N/A'}</span></div>
                <div><strong>Division</strong><span>{user.division || 'N/A'}</span></div>
              </div>
              {user.teacherApplication ? (
                <div className="admin-inline-note">
                  Teacher application: {user.teacherApplication.status}
                </div>
              ) : null}
            </section>

            <section className="admin-panel">
              <h3>Activity summary</h3>
              <div className="admin-meta-grid">
                <div><strong>Questions</strong><span>{user.activitySummary?.questionsCount ?? 0}</span></div>
                <div><strong>Books</strong><span>{user.activitySummary?.booksCount ?? 0}</span></div>
                <div><strong>Contests</strong><span>{user.activitySummary?.contestsCount ?? 0}</span></div>
                <div><strong>Posts</strong><span>{user.activitySummary?.postsCount ?? 0}</span></div>
                <div><strong>Comments</strong><span>{user.activitySummary?.commentsCount ?? 0}</span></div>
                <div><strong>Practice attempts</strong><span>{user.activitySummary?.practiceAttemptsCount ?? 0}</span></div>
              </div>
            </section>
          </div>
        ) : (
          <AdminEmptyState compact title="No user selected" description="Select a user from the table to inspect their account details." />
        )}
      </aside>
    </div>
  );
}
