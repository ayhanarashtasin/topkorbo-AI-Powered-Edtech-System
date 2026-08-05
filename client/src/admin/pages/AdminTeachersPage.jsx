import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminActionButton from '../components/AdminActionButton';
import AdminBadge from '../components/AdminBadge';
import AdminConfirmModal from '../components/AdminConfirmModal';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPagination from '../components/AdminPagination';
import AdminTable from '../components/AdminTable';
import AdminTeacherDetailsDrawer from '../components/AdminTeacherDetailsDrawer';
import {
  fetchAdminTeacherDetails,
  fetchAdminTeachers,
  resetAdminTeacherLiveSessions,
  updateAdminTeacherApplication,
  updateAdminTeacherVerification
} from '../services/adminApi';

const APPLICATION_STATUS_OPTIONS = ['pending', 'under_review', 'approved', 'rejected', 'more_info_requested'];
const VERIFICATION_STATUS_OPTIONS = ['unverified', 'pending', 'verified', 'rejected'];

function formatDate(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
}

function toneForStatus(status) {
  if (status === 'approved' || status === 'verified') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'pending') return 'warning';
  if (status === 'under_review' || status === 'more_info_requested') return 'info';
  return 'neutral';
}

function getViewFromPath(pathname) {
  if (pathname.endsWith('/applications')) return 'applications';
  if (pathname.endsWith('/verification')) return 'verification';
  return 'all';
}

export default function AdminTeachersPage() {
  const location = useLocation();
  const activeView = useMemo(() => getViewFromPath(location.pathname), [location.pathname]);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    verificationStatus: '',
    createdFrom: '',
    createdTo: '',
    page: 1,
    limit: 10
  });
  const [teachers, setTeachers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionState, setActionState] = useState(null);

  async function loadTeachers(nextFilters = filters) {
    try {
      setLoading(true);
      const data = await fetchAdminTeachers({
        ...nextFilters,
        view: activeView
      });
      setTeachers(data?.items || []);
      setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      toast.error(err.message || 'Failed to load teacher records');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTeachers({ ...filters, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTeachers(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.status, filters.verificationStatus, filters.createdFrom, filters.createdTo]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadTeachers({ ...filters, page: 1 });
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  async function openTeacher(userId) {
    setSelectedTeacherId(userId);
    setDetailsLoading(true);
    try {
      const data = await fetchAdminTeacherDetails(userId);
      setSelectedTeacher(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load teacher details');
    } finally {
      setDetailsLoading(false);
    }
  }

  async function refreshSelectedTeacher(userId) {
    const refreshed = await fetchAdminTeacherDetails(userId);
    setSelectedTeacher(refreshed);
  }

  async function handleActionConfirm(reason) {
    try {
      if (actionState.type === 'application') {
        await updateAdminTeacherApplication(actionState.userId, {
          decision: actionState.value,
          reason,
          note: reason
        });
        toast.success('Teacher application updated');
      } else if (actionState.type === 'verification') {
        await updateAdminTeacherVerification(actionState.userId, {
          status: actionState.value,
          note: reason
        });
        toast.success('Teacher verification updated');
      } else if (actionState.type === 'liveSessionsReset') {
        await resetAdminTeacherLiveSessions(actionState.userId, { reason });
        toast.success('Teacher live sessions reset to 0');
      }

      const currentId = actionState.userId;
      setActionState(null);
      await loadTeachers();
      if (selectedTeacherId === currentId) {
        await refreshSelectedTeacher(currentId);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update teacher status');
    }
  }

  const tabs = [
    { label: 'All Teachers', to: '/admin/teachers', end: true },
    { label: 'Applications', to: '/admin/teachers/applications' },
    { label: 'Verification', to: '/admin/teachers/verification' }
  ];

  return (
    <section className="admin-page">
      <AdminPageHeader
        title="Teacher Management"
        description="Review teacher applications, inspect verification documents, and move applicants safely through approval workflows."
        badge={{ label: `${pagination.total} records`, tone: 'info' }}
        tabs={tabs}
      />

      <section className="admin-panel">
        <div className="admin-toolbar">
          <label className="admin-field admin-field--search">
            <span>Search</span>
            <input
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
              placeholder="Name, email, or phone"
            />
          </label>

          <label className="admin-field">
            <span>Application status</span>
            <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))}>
              <option value="">All statuses</option>
              {APPLICATION_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <label className="admin-field">
            <span>Verification</span>
            <select value={filters.verificationStatus} onChange={(event) => setFilters((prev) => ({ ...prev, verificationStatus: event.target.value, page: 1 }))}>
              <option value="">All verification states</option>
              {VERIFICATION_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <label className="admin-field">
            <span>Created from</span>
            <input type="date" value={filters.createdFrom} onChange={(event) => setFilters((prev) => ({ ...prev, createdFrom: event.target.value, page: 1 }))} />
          </label>

          <label className="admin-field">
            <span>Created to</span>
            <input type="date" value={filters.createdTo} onChange={(event) => setFilters((prev) => ({ ...prev, createdTo: event.target.value, page: 1 }))} />
          </label>
        </div>

        {loading ? (
          <div className="admin-page-loader"><div className="admin-spinner" /><p>Loading teacher queue...</p></div>
        ) : teachers.length === 0 ? (
          <AdminEmptyState
            title="No teacher records found"
            description="Try changing the current tab or broadening the status and verification filters."
          />
        ) : (
          <>
            <AdminTable
              columns={['Teacher', 'Email', 'Phone', 'Requested areas', 'Application', 'Verification', 'Applied', 'Actions']}
              minWidth={1180}
            >
              {teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td>
                    <button type="button" className="admin-link-button" onClick={() => openTeacher(teacher.id)}>
                      {teacher.name || 'Unknown teacher'}
                    </button>
                  </td>
                  <td>{teacher.email}</td>
                  <td>{teacher.phoneNumber || 'Not provided'}</td>
                  <td>
                    <div className="admin-chip-row">
                      {(teacher.requestedCategories || []).length ? (
                        teacher.requestedCategories.slice(0, 2).map((item) => (
                          <AdminBadge key={item} tone="neutral" size="sm">{item}</AdminBadge>
                        ))
                      ) : (
                        <span className="admin-table__muted">No categories</span>
                      )}
                    </div>
                  </td>
                  <td><AdminBadge tone={toneForStatus(teacher.applicationStatus)}>{teacher.applicationStatus}</AdminBadge></td>
                  <td><AdminBadge tone={toneForStatus(teacher.verificationStatus)}>{teacher.verificationStatus}</AdminBadge></td>
                  <td>{formatDate(teacher.applicationDate || teacher.applicationUpdatedAt)}</td>
                  <td>
                    <div className="admin-table__actions">
                      <AdminActionButton variant="ghost" onClick={() => openTeacher(teacher.id)}>
                        Review
                      </AdminActionButton>
                    </div>
                  </td>
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

      <AdminTeacherDetailsDrawer
        teacher={selectedTeacher}
        open={Boolean(selectedTeacherId)}
        loading={detailsLoading}
        onClose={() => {
          setSelectedTeacherId('');
          setSelectedTeacher(null);
        }}
        onApplicationAction={(value) => {
          setActionState({
            type: 'application',
            userId: selectedTeacherId,
            value,
            title: `Update application for ${selectedTeacher?.profile?.name || 'this teacher'}?`,
            description: `This will mark the application as "${value.replace(/_/g, ' ')}".`,
            requireReason: value === 'rejected' || value === 'more_info_requested'
          });
        }}
        onVerificationAction={(value) => {
          setActionState({
            type: 'verification',
            userId: selectedTeacherId,
            value,
            title: `Update verification for ${selectedTeacher?.profile?.name || 'this teacher'}?`,
            description: `This will set verification to "${value}".`,
            requireReason: value === 'rejected'
          });
        }}
        onLiveSessionReset={() => {
          setActionState({
            type: 'liveSessionsReset',
            userId: selectedTeacherId,
            title: `Reset live sessions for ${selectedTeacher?.profile?.name || 'this teacher'}?`,
            description: 'This sets the mentor panel weekly usage back to 0 and allows the teacher to start classes again this week.',
            requireReason: false
          });
        }}
      />

      <AdminConfirmModal
        open={Boolean(actionState)}
        title={actionState?.title}
        description={actionState?.description}
        requireReason={actionState?.requireReason}
        reasonLabel={actionState?.type === 'verification' ? 'Verification note' : 'Admin reason'}
        confirmLabel={actionState?.type === 'liveSessionsReset' ? 'Reset to 0' : 'Save update'}
        onClose={() => setActionState(null)}
        onConfirm={handleActionConfirm}
      />
    </section>
  );
}
