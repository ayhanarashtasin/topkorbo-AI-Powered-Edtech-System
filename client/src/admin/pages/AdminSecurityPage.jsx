import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminBadge from '../components/AdminBadge';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminLoadingState from '../components/AdminLoadingState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPagination from '../components/AdminPagination';
import AdminStatCard from '../components/AdminStatCard';
import AdminTable from '../components/AdminTable';
import { fetchAdminLoginHistory, fetchAdminSecuritySignals } from '../services/adminApi';

const SECURITY_TABS = [
  { id: 'logins', label: 'Login History' },
  { id: 'suspicious', label: 'Suspicious Activity' }
];

function formatDate(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function toneForLoginStatus(status) {
  if (status === 'success') return 'success';
  if (status === 'failure') return 'danger';
  return 'neutral';
}

function toneForSeverity(severity) {
  if (severity === 'danger') return 'danger';
  if (severity === 'warning') return 'warning';
  if (severity === 'info') return 'info';
  return 'neutral';
}

export default function AdminSecurityPage() {
  const [activeTab, setActiveTab] = useState('logins');
  const [loginFilters, setLoginFilters] = useState({
    search: '',
    status: '',
    page: 1,
    limit: 15
  });
  const [logins, setLogins] = useState([]);
  const [loginStats, setLoginStats] = useState({ success: 0, failure: 0 });
  const [loginPagination, setLoginPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loginsLoading, setLoginsLoading] = useState(true);

  const [signals, setSignals] = useState([]);
  const [signalSummary, setSignalSummary] = useState({ total: 0, bySource: {} });
  const [signalPagination, setSignalPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [signalsLoading, setSignalsLoading] = useState(true);

  async function loadLogins(nextFilters = loginFilters) {
    try {
      setLoginsLoading(true);
      const data = await fetchAdminLoginHistory(nextFilters);
      setLogins(data?.items || []);
      setLoginStats(data?.stats || { success: 0, failure: 0 });
      setLoginPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      toast.error(err.message || 'Failed to load login history');
    } finally {
      setLoginsLoading(false);
    }
  }

  async function loadSignals(page = signalPagination.page || 1) {
    try {
      setSignalsLoading(true);
      const data = await fetchAdminSecuritySignals({ page, limit: 15 });
      setSignals(data?.items || []);
      setSignalSummary(data?.summary || { total: 0, bySource: {} });
      setSignalPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      toast.error(err.message || 'Failed to load suspicious activity');
    } finally {
      setSignalsLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadLogins(loginFilters);
    }, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginFilters.page, loginFilters.status]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadLogins({ ...loginFilters, page: 1 });
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginFilters.search]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadSignals(signalPagination.page || 1);
    }, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalPagination.page]);

  return (
    <section className="admin-page">
      <AdminPageHeader
        title="Security"
        description="Review future login history and investigate suspicious signals assembled from real moderation, anti-cheat, account restriction, and audit records."
        badge={{ label: `${signalSummary.total || 0} signals`, tone: 'info' }}
      />

      <div className="admin-tabs" role="tablist" aria-label="Security tabs">
        {SECURITY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`admin-tab ${activeTab === tab.id ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'logins' ? (
        <>
          <div className="admin-stats-grid">
            <AdminStatCard label="Login events" value={loginPagination.total} hint="Future logins are recorded from the auth callback" tone="info" />
            <AdminStatCard label="Successful" value={loginStats.success || 0} hint="Completed Google login callbacks" tone="success" />
            <AdminStatCard label="Failed" value={loginStats.failure || 0} hint="Blocked or unsuccessful login attempts" tone="danger" />
            <AdminStatCard label="Tracked data" value="IP + device" hint="No passwords, tokens, or secrets are stored" tone="neutral" />
            <AdminStatCard label="Method" value="Google OAuth" hint="Current login method detected in code" tone="warning" />
          </div>

          <section className="admin-panel">
            <div className="admin-toolbar">
              <label className="admin-field admin-field--search">
                <span>Search</span>
                <input
                  value={loginFilters.search}
                  onChange={(event) => setLoginFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
                  placeholder="User, email, IP, browser"
                />
              </label>

              <label className="admin-field">
                <span>Status</span>
                <select value={loginFilters.status} onChange={(event) => setLoginFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))}>
                  <option value="">All statuses</option>
                  <option value="success">success</option>
                  <option value="failure">failure</option>
                </select>
              </label>
            </div>

            {loginsLoading ? (
              <AdminLoadingState label="Loading login history..." />
            ) : logins.length === 0 ? (
              <AdminEmptyState
                title="No login history yet"
                description="Tracking has been added for future logins only, so this table will populate as new auth callbacks happen."
              />
            ) : (
              <>
                <AdminTable
                  columns={['User', 'Role', 'Login time', 'Status', 'IP', 'Device / browser', 'Failure reason']}
                  minWidth={1280}
                >
                  {logins.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <strong>{entry.user?.name || entry.email || 'Unknown user'}</strong>
                        <div className="admin-table__muted">{entry.email || 'N/A'}</div>
                      </td>
                      <td>{entry.role || 'N/A'}</td>
                      <td>{formatDate(entry.createdAt)}</td>
                      <td><AdminBadge tone={toneForLoginStatus(entry.status)}>{entry.status}</AdminBadge></td>
                      <td>{entry.ipAddress || 'N/A'}</td>
                      <td>{[entry.device, entry.browser].filter(Boolean).join(' / ') || 'N/A'}</td>
                      <td>{entry.failureReason || 'N/A'}</td>
                    </tr>
                  ))}
                </AdminTable>

                <AdminPagination
                  page={loginPagination.page}
                  totalPages={loginPagination.totalPages}
                  onChange={(page) => setLoginFilters((prev) => ({ ...prev, page }))}
                />
              </>
            )}
          </section>
        </>
      ) : null}

      {activeTab === 'suspicious' ? (
        <>
          <div className="admin-stats-grid">
            <AdminStatCard label="Signals" value={signalSummary.total || 0} hint="Real data sources only" tone="info" />
            <AdminStatCard label="Failed login clusters" value={signalSummary.bySource?.failed_login_cluster || 0} hint="3+ failures grouped by IP/email" tone="danger" />
            <AdminStatCard label="Anti-cheat flags" value={signalSummary.bySource?.contest_anti_cheat || 0} hint="Contest attempts flagged in Phase 7B" tone="warning" />
            <AdminStatCard label="Restricted accounts" value={signalSummary.bySource?.account_restriction || 0} hint="Recent suspend or ban actions" tone="neutral" />
            <AdminStatCard label="Moderation / role changes" value={(signalSummary.bySource?.moderation_report || 0) + (signalSummary.bySource?.role_change || 0)} hint="Reports and privileged role changes" tone="success" />
          </div>

          <section className="admin-panel">
            {signalsLoading ? (
              <AdminLoadingState label="Loading suspicious activity..." />
            ) : signals.length === 0 ? (
              <AdminEmptyState
                title="No suspicious activity detected from available sources"
                description="This section stays empty until real login failures, flagged contest attempts, account restrictions, moderation reports, or privileged role changes are present."
              />
            ) : (
              <>
                <AdminTable
                  columns={['Source', 'Severity', 'Event', 'User', 'Date', 'Link']}
                  minWidth={1180}
                >
                  {signals.map((signal) => (
                    <tr key={signal.id}>
                      <td>{signal.source}</td>
                      <td><AdminBadge tone={toneForSeverity(signal.severity)}>{signal.severity}</AdminBadge></td>
                      <td>
                        <strong>{signal.title}</strong>
                        <div className="admin-table__muted">{signal.description}</div>
                      </td>
                      <td>{signal.user ? `${signal.user.name} (${signal.user.email})` : 'N/A'}</td>
                      <td>{formatDate(signal.createdAt)}</td>
                      <td>{signal.linkPath || 'N/A'}</td>
                    </tr>
                  ))}
                </AdminTable>

                <AdminPagination
                  page={signalPagination.page}
                  totalPages={signalPagination.totalPages}
                  onChange={(page) => setSignalPagination((prev) => ({ ...prev, page }))}
                />
              </>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
