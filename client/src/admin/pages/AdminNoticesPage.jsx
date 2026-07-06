import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import AdminActionButton from '../components/AdminActionButton';
import AdminBadge from '../components/AdminBadge';
import AdminConfirmModal from '../components/AdminConfirmModal';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPagination from '../components/AdminPagination';
import AdminTable from '../components/AdminTable';
import {
  archiveAdminNotice,
  createAdminNotice,
  fetchAdminNotices,
  updateAdminNotice
} from '../services/adminApi';

const TYPE_OPTIONS = ['info', 'success', 'warning', 'danger'];
const AUDIENCE_OPTIONS = ['all', 'students', 'teachers'];
const LOCATION_OPTIONS = ['homepage', 'student_dashboard', 'teacher_dashboard', 'all_dashboards'];

function formatDate(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
}

function toneForType(type) {
  if (type === 'success') return 'success';
  if (type === 'warning') return 'warning';
  if (type === 'danger') return 'danger';
  return 'info';
}

function toneForStatus(status) {
  return status === 'active' ? 'success' : 'neutral';
}

function NoticeModal({ open, mode, notice, saving, onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({
    title: notice?.title || '',
    message: notice?.message || '',
    type: notice?.type || 'info',
    audience: notice?.audience || 'all',
    location: notice?.location || 'homepage',
    startsAt: notice?.startsAt ? new Date(notice.startsAt).toISOString().slice(0, 10) : '',
    endsAt: notice?.endsAt ? new Date(notice.endsAt).toISOString().slice(0, 10) : ''
  }));

  if (!open) return null;

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal admin-modal--large" onClick={(event) => event.stopPropagation()}>
        <h3>{mode === 'create' ? 'Create notice' : 'Edit notice'}</h3>
        <p>Manage dashboard or homepage messaging without rewriting the current public layout. Public rendering integration remains intentionally decoupled for safety.</p>

        <div className="admin-modal-form-grid">
          <label className="admin-field">
            <span>Title</span>
            <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
          </label>
          <label className="admin-field">
            <span>Type</span>
            <select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}>
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Audience</span>
            <select value={form.audience} onChange={(event) => setForm((prev) => ({ ...prev, audience: event.target.value }))}>
              {AUDIENCE_OPTIONS.map((audience) => (
                <option key={audience} value={audience}>{audience}</option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Location</span>
            <select value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}>
              {LOCATION_OPTIONS.map((location) => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Start date</span>
            <input type="date" value={form.startsAt} onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))} />
          </label>
          <label className="admin-field">
            <span>End date</span>
            <input type="date" value={form.endsAt} onChange={(event) => setForm((prev) => ({ ...prev, endsAt: event.target.value }))} />
          </label>
          <label className="admin-field" style={{ gridColumn: '1 / -1' }}>
            <span>Message</span>
            <textarea rows={5} value={form.message} onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))} />
          </label>
        </div>

        <div className="admin-panel admin-panel--flat">
          <div className="admin-panel__header">
            <div>
              <h3>Preview</h3>
              <p className="admin-panel__subtext">This is an admin preview card, not a live public placement.</p>
            </div>
          </div>
          <div className="admin-hero__banner">
            <div>
              <p className="admin-topbar__eyebrow">{form.location.replace(/_/g, ' ')}</p>
              <h3>{form.title || 'Notice title'}</h3>
              <p>{form.message || 'Notice preview text will appear here.'}</p>
            </div>
            <AdminBadge tone={toneForType(form.type)}>{form.type}</AdminBadge>
          </div>
        </div>

        <div className="admin-modal__actions">
          <button type="button" className="admin-button admin-button--ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="admin-button"
            disabled={saving || !form.title.trim() || !form.message.trim()}
            onClick={() => onSubmit(form)}
          >
            {saving ? 'Saving...' : mode === 'create' ? 'Create notice' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminNoticesPage() {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    location: '',
    audience: '',
    page: 1,
    limit: 10
  });
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState({ open: false, mode: 'create', notice: null });
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  async function loadData(nextFilters = filters) {
    try {
      setLoading(true);
      const data = await fetchAdminNotices(nextFilters);
      setItems(data?.items || []);
      setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      toast.error(err.message || 'Failed to load notices');
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
  }, [filters.page, filters.status, filters.location, filters.audience]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadData({ ...filters, page: 1 });
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  async function handleSave(form) {
    try {
      setSaving(true);
      const payload = {
        ...form,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null
      };
      if (modalState.mode === 'create') {
        await createAdminNotice(payload);
        toast.success('Notice created');
      } else {
        await updateAdminNotice(modalState.notice.id, payload);
        toast.success('Notice updated');
      }
      setModalState({ open: false, mode: 'create', notice: null });
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to save notice');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    try {
      setSaving(true);
      await archiveAdminNotice(archiveTarget.id);
      toast.success('Notice archived');
      setArchiveTarget(null);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to archive notice');
    } finally {
      setSaving(false);
    }
  }

  const activeCount = useMemo(() => items.filter((item) => item.status === 'active').length, [items]);

  return (
    <section className="admin-page">
      <AdminPageHeader
        title="Notices & Banners"
        description="Create and manage timed admin notices for homepage or dashboard surfaces without coupling this phase to public rendering changes."
        badge={{ label: `${pagination.total} notices`, tone: 'info' }}
        actions={(
          <AdminActionButton onClick={() => setModalState({ open: true, mode: 'create', notice: null })}>
            Create notice
          </AdminActionButton>
        )}
      />

      <section className="admin-panels-grid">
        <div className="admin-panel">
          <div className="admin-toolbar">
            <label className="admin-field admin-field--search">
              <span>Search</span>
              <input value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))} placeholder="Search by title or message" />
            </label>
            <label className="admin-field">
              <span>Status</span>
              <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))}>
                <option value="">All statuses</option>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
            </label>
            <label className="admin-field">
              <span>Location</span>
              <select value={filters.location} onChange={(event) => setFilters((prev) => ({ ...prev, location: event.target.value, page: 1 }))}>
                <option value="">All locations</option>
                {LOCATION_OPTIONS.map((location) => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              <span>Audience</span>
              <select value={filters.audience} onChange={(event) => setFilters((prev) => ({ ...prev, audience: event.target.value, page: 1 }))}>
                <option value="">All audiences</option>
                {AUDIENCE_OPTIONS.map((audience) => (
                  <option key={audience} value={audience}>{audience}</option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="admin-page-loader"><div className="admin-spinner" /><p>Loading notices...</p></div>
          ) : items.length === 0 ? (
            <AdminEmptyState title="No notices found" description="Create the first notice or banner configuration for homepage and dashboard messaging." />
          ) : (
            <>
              <AdminTable columns={['Title', 'Type', 'Audience / Location', 'Schedule', 'Status', 'Actions']} minWidth={1160}>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      <div className="admin-table__muted">{item.message}</div>
                    </td>
                    <td><AdminBadge tone={toneForType(item.type)}>{item.type}</AdminBadge></td>
                    <td>
                      <strong>{item.audience}</strong>
                      <div className="admin-table__muted">{item.location}</div>
                    </td>
                    <td>
                      <strong>{formatDate(item.startsAt)}</strong>
                      <div className="admin-table__muted">Ends {formatDate(item.endsAt)}</div>
                    </td>
                    <td><AdminBadge tone={toneForStatus(item.status)}>{item.status}</AdminBadge></td>
                    <td>
                      <div className="admin-table__actions">
                        <AdminActionButton variant="ghost" onClick={() => setModalState({ open: true, mode: 'edit', notice: item })}>Edit</AdminActionButton>
                        {item.status !== 'archived' ? (
                          <AdminActionButton tone="danger" variant="ghost" onClick={() => setArchiveTarget(item)}>Archive</AdminActionButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </AdminTable>
              <AdminPagination page={pagination.page} totalPages={pagination.totalPages} onChange={(page) => setFilters((prev) => ({ ...prev, page }))} />
            </>
          )}
        </div>

        <aside className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Deployment note</h3>
              <p className="admin-panel__subtext">This phase implements the admin management layer and data validation first.</p>
            </div>
          </div>
          <ul className="admin-list admin-list--compact">
            <li>
              <div>
                <strong>Admin CRUD</strong>
                <span>Create, edit, and archive notices with scheduling.</span>
              </div>
              <AdminBadge tone="success" size="sm">Live</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Public rendering</strong>
                <span>Not connected automatically to homepage/dashboard surfaces in this phase.</span>
              </div>
              <AdminBadge tone="neutral" size="sm">Pending</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Currently active</strong>
                <span>{activeCount} notices are active in admin state.</span>
              </div>
              <AdminBadge tone="info" size="sm">{activeCount}</AdminBadge>
            </li>
          </ul>
        </aside>
      </section>

      <NoticeModal
        key={`${modalState.mode}-${modalState.notice?.id || 'new'}-${modalState.open ? 'open' : 'closed'}`}
        open={modalState.open}
        mode={modalState.mode}
        notice={modalState.notice}
        saving={saving}
        onClose={() => setModalState({ open: false, mode: 'create', notice: null })}
        onSubmit={handleSave}
      />

      <AdminConfirmModal
        open={Boolean(archiveTarget)}
        title={archiveTarget ? `Archive ${archiveTarget.title}?` : ''}
        description="Archived notices remain available in admin history but should be treated as inactive."
        confirmLabel={saving ? 'Archiving...' : 'Archive notice'}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
      />
    </section>
  );
}
