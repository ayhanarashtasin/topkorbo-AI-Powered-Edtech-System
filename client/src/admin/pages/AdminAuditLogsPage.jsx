import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminBadge from '../components/AdminBadge';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPagination from '../components/AdminPagination';
import AdminTable from '../components/AdminTable';
import { fetchAdminAuditLogs } from '../services/adminApi';

function formatDate(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function toneForAction(action) {
  if (action.includes('UNBANNED') || action.includes('REACTIVATED') || action.includes('APPROVED') || action.includes('VERIFIED') || action.includes('CREATED') || action.includes('RESOLVED')) return 'success';
  if (action.includes('FAILED') || action.includes('REJECTED') || action.includes('ARCHIVED') || action === 'USER_BANNED') return 'danger';
  if (action.includes('DISMISSED')) return 'neutral';
  if (action.includes('SUSPENDED')) return 'warning';
  return 'info';
}

function summarizeValue(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.length ? value.map((item) => summarizeValue(item)).join(', ') : '[]';
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== '')
      .slice(0, 4)
      .map(([key, entryValue]) => `${key}: ${summarizeValue(entryValue)}`);
    return entries.length ? entries.join(' | ') : 'N/A';
  }
  return String(value);
}

export default function AdminAuditLogsPage() {
  const [filters, setFilters] = useState({ action: '', search: '', targetType: '', page: 1, limit: 20 });
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [availableActions, setAvailableActions] = useState([]);
  const [availableTargetTypes, setAvailableTargetTypes] = useState([]);
  const [searchInput, setSearchInput] = useState('');
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
        setAvailableActions(data?.meta?.actions || []);
        setAvailableTargetTypes(data?.meta?.targetTypes || []);
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
        description="Review sensitive admin actions across users, teachers, notifications, support, moderation, appeals, questions, books, and academic taxonomy changes."
        badge={{ label: `${pagination.total} events`, tone: 'info' }}
      />

      <section className="admin-panel">
        <form
          className="admin-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            setFilters((prev) => ({ ...prev, search: searchInput.trim(), page: 1 }));
          }}
        >
          <label className="admin-field">
            <span>Action type</span>
            <select value={filters.action} onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value, page: 1 }))}>
              <option value="">All actions</option>
              {availableActions.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Target type</span>
            <select value={filters.targetType} onChange={(event) => setFilters((prev) => ({ ...prev, targetType: event.target.value, page: 1 }))}>
              <option value="">All targets</option>
              {availableTargetTypes.map((targetType) => (
                <option key={targetType} value={targetType}>{targetType}</option>
              ))}
            </select>
          </label>
          <label className="admin-field admin-field--search">
            <span>Search</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Reason, action, or target"
            />
          </label>
          <button type="submit" className="admin-button admin-button--ghost">Apply</button>
        </form>

        {loading ? (
          <div className="admin-page-loader"><div className="admin-spinner" /><p>Loading audit history...</p></div>
        ) : logs.length === 0 ? (
          <AdminEmptyState title="No audit events found" description="Audit entries will appear here as admins work across users, teachers, content, contests, communications, payments, settings, and moderation." />
        ) : (
          <>
            <AdminTable
              columns={['Action', 'Admin', 'Target', 'Changes', 'Reason', 'Timestamp']}
              minWidth={1280}
            >
              {logs.map((entry) => (
                <tr key={entry.id}>
                  <td><AdminBadge tone={toneForAction(entry.actionType)}>{entry.actionType}</AdminBadge></td>
                  <td>
                    <strong>{entry.admin?.name || 'Unknown admin'}</strong>
                    <div className="admin-table__muted">{entry.admin?.email || 'N/A'}</div>
                  </td>
                  <td>
                    <strong>{entry.target?.name || entry.targetUser?.name || entry.targetQuestion?.questionText || 'Unknown target'}</strong>
                    <div className="admin-table__muted">
                      {entry.targetUser?.email || [entry.target?.type, entry.targetQuestion?.subject, entry.targetQuestion?.chapter].filter(Boolean).join(' | ') || 'N/A'}
                    </div>
                  </td>
                  <td>
                    <div className="admin-table__muted">From: {summarizeValue(entry.previousValue)}</div>
                    <div className="admin-table__muted">To: {summarizeValue(entry.newValue)}</div>
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
