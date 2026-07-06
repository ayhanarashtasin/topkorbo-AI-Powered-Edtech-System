import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminActionButton from '../components/AdminActionButton';
import AdminBadge from '../components/AdminBadge';
import AdminConfirmModal from '../components/AdminConfirmModal';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminIeltsSetDetailsDrawer from '../components/AdminIeltsSetDetailsDrawer';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPagination from '../components/AdminPagination';
import AdminTable from '../components/AdminTable';
import {
  approveAdminIeltsSet,
  fetchAdminIeltsSetDetails,
  fetchAdminIeltsSets,
  rejectAdminIeltsSet
} from '../services/adminApi';

const STATUS_OPTIONS = ['pending', 'approved', 'rejected'];
const TYPE_OPTIONS = ['listening', 'writing'];

function formatDate(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
}

function toneForStatus(status) {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

export default function AdminIeltsSetsPage() {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    type: '',
    page: 1,
    limit: 10
  });
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [meta, setMeta] = useState({ supportedTypes: ['listening', 'writing'], unsupportedTypes: ['reading', 'speaking'] });
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionState, setActionState] = useState(null);

  async function loadData(nextFilters = filters) {
    try {
      setLoading(true);
      const data = await fetchAdminIeltsSets(nextFilters);
      setItems(data?.items || []);
      setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
      setMeta({
        supportedTypes: data?.supportedTypes || ['listening', 'writing'],
        unsupportedTypes: data?.unsupportedTypes || ['reading', 'speaking']
      });
    } catch (err) {
      toast.error(err.message || 'Failed to load IELTS sets');
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
  }, [filters.page, filters.status, filters.type]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadData({ ...filters, page: 1 });
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  async function openItem(item) {
    setDetailsLoading(true);
    try {
      const data = await fetchAdminIeltsSetDetails(item.setType, item.id);
      setSelectedItem(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load IELTS set details');
    } finally {
      setDetailsLoading(false);
    }
  }

  async function handleActionConfirm(reason) {
    try {
      if (actionState?.type === 'approve') {
        await approveAdminIeltsSet(actionState.setType, actionState.setId, { reason });
        toast.success('IELTS set approved');
      } else if (actionState?.type === 'reject') {
        await rejectAdminIeltsSet(actionState.setType, actionState.setId, { reason });
        toast.success('IELTS set rejected');
      }

      const current = actionState;
      setActionState(null);
      await loadData();
      if (selectedItem && current && selectedItem.id === current.setId && selectedItem.setType === current.setType) {
        const refreshed = await fetchAdminIeltsSetDetails(current.setType, current.setId);
        setSelectedItem(refreshed);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update IELTS set status');
    }
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        title="IELTS Sets"
        description="Review teacher-uploaded IELTS listening and writing sets. Reading and speaking set approval are not modeled in the current project schema."
        badge={{ label: `${pagination.total} sets`, tone: 'info' }}
      />

      <section className="admin-panels-grid">
        <div className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Approval queue</h3>
              <p className="admin-panel__subtext">Approved sets remain visible in the current student IELTS flows. Rejected sets stay hidden.</p>
            </div>
          </div>

          <div className="admin-toolbar">
            <label className="admin-field admin-field--search">
              <span>Search</span>
              <input
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
                placeholder="Search by set title"
              />
            </label>
            <label className="admin-field">
              <span>Status</span>
              <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))}>
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              <span>IELTS type</span>
              <select value={filters.type} onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value, page: 1 }))}>
                <option value="">All supported types</option>
                {TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="admin-page-loader"><div className="admin-spinner" /><p>Loading IELTS sets...</p></div>
          ) : items.length === 0 ? (
            <AdminEmptyState
              title="No IELTS sets found"
              description="This page shows real listening and writing uploads only. Reading and speaking set approval will need schema support later."
            />
          ) : (
            <>
              <AdminTable columns={['Set title', 'IELTS type', 'Uploader', 'Created', 'Status', 'Actions']} minWidth={1080}>
                {items.map((item) => (
                  <tr key={`${item.setType}-${item.id}`}>
                    <td>
                      <button type="button" className="admin-link-button" onClick={() => openItem(item)}>
                        {item.title}
                      </button>
                    </td>
                    <td><AdminBadge tone="info">{item.setTypeLabel}</AdminBadge></td>
                    <td>
                      <strong>{item.uploader?.name || 'Unknown teacher'}</strong>
                      <div className="admin-table__muted">{item.uploader?.email || 'N/A'}</div>
                    </td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td><AdminBadge tone={toneForStatus(item.status)}>{item.status}</AdminBadge></td>
                    <td>
                      <div className="admin-table__actions">
                        <AdminActionButton variant="ghost" onClick={() => openItem(item)}>View</AdminActionButton>
                        {item.status !== 'approved' ? (
                          <AdminActionButton onClick={() => setActionState({
                            type: 'approve',
                            setType: item.setType,
                            setId: item.id,
                            title: `Approve ${item.title}?`,
                            description: 'This will allow the set to appear in the existing student IELTS flows.'
                          })}
                          >
                            Approve
                          </AdminActionButton>
                        ) : null}
                        {item.status !== 'rejected' ? (
                          <AdminActionButton tone="danger" variant="ghost" onClick={() => setActionState({
                            type: 'reject',
                            setType: item.setType,
                            setId: item.id,
                            title: `Reject ${item.title}?`,
                            description: 'Rejected IELTS sets should stay hidden from student practice views.',
                            requireReason: true
                          })}
                          >
                            Reject
                          </AdminActionButton>
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
              <h3>Current scope</h3>
              <p className="admin-panel__subtext">This phase only integrates the IELTS set types that already have real upload models.</p>
            </div>
          </div>

          <ul className="admin-list admin-list--compact">
            <li>
              <div>
                <strong>Supported now</strong>
                <span>{meta.supportedTypes.join(', ')}</span>
              </div>
              <AdminBadge tone="success" size="sm">Live</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Not modeled yet</strong>
                <span>{meta.unsupportedTypes.join(', ')}</span>
              </div>
              <AdminBadge tone="neutral" size="sm">Documented</AdminBadge>
            </li>
          </ul>
        </aside>
      </section>

      <AdminIeltsSetDetailsDrawer
        item={selectedItem}
        open={Boolean(selectedItem)}
        loading={detailsLoading}
        onClose={() => setSelectedItem(null)}
        onApprove={() => setActionState({
          type: 'approve',
          setType: selectedItem?.setType,
          setId: selectedItem?.id,
          title: `Approve ${selectedItem?.title || 'this set'}?`,
          description: 'This will allow the set to appear in the existing student IELTS flows.'
        })}
        onReject={() => setActionState({
          type: 'reject',
          setType: selectedItem?.setType,
          setId: selectedItem?.id,
          title: `Reject ${selectedItem?.title || 'this set'}?`,
          description: 'Rejected IELTS sets should stay hidden from student practice views.',
          requireReason: true
        })}
      />

      <AdminConfirmModal
        open={Boolean(actionState)}
        title={actionState?.title || ''}
        description={actionState?.description || ''}
        requireReason={Boolean(actionState?.requireReason)}
        reasonLabel="Reviewer note"
        confirmLabel={actionState?.type === 'reject' ? 'Reject set' : 'Approve set'}
        onClose={() => setActionState(null)}
        onConfirm={handleActionConfirm}
      />
    </section>
  );
}
