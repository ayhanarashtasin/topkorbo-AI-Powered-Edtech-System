import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminActionButton from '../components/AdminActionButton';
import AdminBadge from '../components/AdminBadge';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPagination from '../components/AdminPagination';
import AdminTable from '../components/AdminTable';
import { fetchAdminWaitlist, updateAdminWaitlistContacted } from '../services/adminApi';

function formatDate(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
}

export default function AdminWaitlistPage() {
  const [filters, setFilters] = useState({
    search: '',
    contacted: '',
    targetExam: '',
    page: 1,
    limit: 20
  });
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  async function loadData(nextFilters = filters) {
    try {
      setLoading(true);
      const data = await fetchAdminWaitlist(nextFilters);
      setItems(data?.items || []);
      setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      toast.error(err.message || 'Failed to load waitlist entries');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadData(filters);
    }, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.contacted, filters.targetExam]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadData({ ...filters, page: 1 });
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  async function handleToggleContacted(item) {
    try {
      await updateAdminWaitlistContacted(item.id, { contacted: !item.contacted });
      toast.success(item.contacted ? 'Marked as not contacted' : 'Marked as contacted');
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update waitlist contact status');
    }
  }

  async function handleExport() {
    try {
      setExporting(true);
      const token = localStorage.getItem('topkorbo_token');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') {
          params.set(key, String(value));
        }
      });

      const response = await fetch(`${apiBase}/admin/content/waitlist/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('Failed to export waitlist CSV');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'waitlist-export.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Waitlist CSV exported');
    } catch (err) {
      toast.error(err.message || 'Failed to export waitlist CSV');
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        title="Waitlist"
        description="Review real landing-page waitlist signups, track outreach status, and export entries when the team needs an external follow-up list."
        badge={{ label: `${pagination.total} entries`, tone: 'info' }}
        actions={(
          <AdminActionButton variant="ghost" onClick={handleExport}>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </AdminActionButton>
        )}
      />

      <section className="admin-panel">
        <div className="admin-toolbar">
          <label className="admin-field admin-field--search">
            <span>Search</span>
            <input value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))} placeholder="Search name, email, or phone" />
          </label>
          <label className="admin-field">
            <span>Contacted</span>
            <select value={filters.contacted} onChange={(event) => setFilters((prev) => ({ ...prev, contacted: event.target.value, page: 1 }))}>
              <option value="">All</option>
              <option value="true">Contacted</option>
              <option value="false">Not contacted</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Target exam</span>
            <input value={filters.targetExam} onChange={(event) => setFilters((prev) => ({ ...prev, targetExam: event.target.value, page: 1 }))} placeholder="BUET, DU, Medical..." />
          </label>
        </div>

        {loading ? (
          <div className="admin-page-loader"><div className="admin-spinner" /><p>Loading waitlist entries...</p></div>
        ) : items.length === 0 ? (
          <AdminEmptyState title="No waitlist entries found" description="This table only shows real landing-page waitlist signups. If the funnel has not collected entries yet, the table stays empty." />
        ) : (
          <>
            <AdminTable columns={['Name', 'Email', 'Phone', 'Interest', 'Language', 'Created', 'Contacted', 'Actions']} minWidth={1180}>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.email}</td>
                  <td>{item.phone || 'N/A'}</td>
                  <td>{item.targetExam || 'Other'}</td>
                  <td>{item.language || 'en'}</td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td><AdminBadge tone={item.contacted ? 'success' : 'warning'}>{item.contacted ? 'contacted' : 'pending'}</AdminBadge></td>
                  <td>
                    <div className="admin-table__actions">
                      <AdminActionButton variant="ghost" onClick={() => handleToggleContacted(item)}>
                        {item.contacted ? 'Mark Uncontacted' : 'Mark Contacted'}
                      </AdminActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </AdminTable>
            <AdminPagination page={pagination.page} totalPages={pagination.totalPages} onChange={(page) => setFilters((prev) => ({ ...prev, page }))} />
          </>
        )}
      </section>
    </section>
  );
}
