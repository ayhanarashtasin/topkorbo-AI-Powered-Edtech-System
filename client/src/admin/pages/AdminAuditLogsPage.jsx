import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminBadge from '../components/AdminBadge';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPagination from '../components/AdminPagination';
import AdminTable from '../components/AdminTable';
import { fetchAdminAuditLogs } from '../services/adminApi';

const ACTION_OPTIONS = [
  'ROLE_CHANGED',
  'USER_BANNED',
  'USER_UNBANNED',
  'USER_SUSPENDED',
  'USER_REACTIVATED',
  'TEACHER_APPROVED',
  'TEACHER_REJECTED',
  'TEACHER_VERIFIED',
  'TEACHER_VERIFICATION_REJECTED',
  'TEACHER_MORE_INFO_REQUESTED'
];

function formatDate(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function toneForAction(action) {
  if (action.includes('UNBANNED') || action.includes('REACTIVATED') || action.includes('APPROVED') || action.includes('VERIFIED')) return 'success';
  if (action.includes('REJECTED') || action === 'USER_BANNED') return 'danger';
  if (action.includes('SUSPENDED')) return 'warning';
  return 'info';
}

export default function AdminAuditLogsPage() {
  const [filters, setFilters] = useState({ action: '', page: 1, limit: 20 });
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchAdminAuditLogs(filters);
        if (!active) return;
        setLogs(data?.items || []);
        setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
      } catch (err) {
        if (active) {
          toast.error(err.message || 'Failed to load audit logs');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [filters]);

  return (
    <section className="admin-page">
      <AdminPageHeader
        title="Audit Logs"
        description="Review sensitive admin actions across user management and teacher operations."
        badge={{ label: `${pagination.total} events`, tone: 'info' }}
      />

      <section className="admin-panel">
        <div className="admin-toolbar">
          <label className="admin-field">
            <span>Action type</span>
            <select value={filters.action} onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value, page: 1 }))}>
              <option value="">All actions</option>
              {ACTION_OPTIONS.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="admin-page-loader"><div className="admin-spinner" /><p>Loading audit history...</p></div>
        ) : logs.length === 0 ? (
          <AdminEmptyState title="No audit events found" description="Audit entries will appear here as admins change roles, statuses, and teacher decisions." />
        ) : (
          <>
            <AdminTable
              columns={['Action', 'Admin', 'Target user', 'Reason', 'Timestamp']}
              minWidth={1040}
            >
              {logs.map((entry) => (
                <tr key={entry.id}>
                  <td><AdminBadge tone={toneForAction(entry.actionType)}>{entry.actionType}</AdminBadge></td>
                  <td>
                    <strong>{entry.admin?.name || 'Unknown admin'}</strong>
                    <div className="admin-table__muted">{entry.admin?.email || 'N/A'}</div>
                  </td>
                  <td>
                    <strong>{entry.targetUser?.name || 'Unknown user'}</strong>
                    <div className="admin-table__muted">{entry.targetUser?.email || 'N/A'}</div>
                  </td>
                  <td>{entry.reason || 'No reason recorded'}</td>
                  <td>{formatDate(entry.createdAt)}</td>
                </tr>
              ))}
            </AdminTable>

            <AdminPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onChange={(page) => setFilters((prev) => ({ ...prev, page }))}
            />
          </>
        )}
      </section>
    </section>
  );
}
