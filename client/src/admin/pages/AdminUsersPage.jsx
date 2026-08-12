import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminActionButton from '../components/AdminActionButton';
import AdminBadge from '../components/AdminBadge';
import AdminConfirmModal from '../components/AdminConfirmModal';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPagination from '../components/AdminPagination';
import AdminTable from '../components/AdminTable';
import AdminUserDetailsDrawer from '../components/AdminUserDetailsDrawer';
import {
  fetchAdminUserDetails,
  fetchAdminUsers,
  resetAdminMentorLiveSessions,
  updateAdminUserRole,
  updateAdminUserStatus,
  deleteAdminUser
} from '../services/adminApi';

const ROLE_OPTIONS = ['student', 'tutor', 'teacher', 'moderator', 'admin'];
const STATUS_OPTIONS = ['active', 'suspended', 'banned'];

function formatDate(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
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

export default function AdminUsersPage() {
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    status: '',
    createdFrom: '',
    createdTo: '',
    page: 1,
    limit: 10
  });
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionState, setActionState] = useState(null);

  const activeDrawer = Boolean(selectedUserId);

  async function loadUsers(nextFilters = filters) {
    try {
      setLoading(true);
      const data = await fetchAdminUsers(nextFilters);
      setUsers(data?.items || []);
      setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      toast.error(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.role, filters.status, filters.createdFrom, filters.createdTo]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadUsers({ ...filters, page: 1 });
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  async function openUser(userId) {
    setSelectedUserId(userId);
    setDetailsLoading(true);
    try {
      const data = await fetchAdminUserDetails(userId);
      setSelectedUser(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load user details');
    } finally {
      setDetailsLoading(false);
    }
  }

  async function handleRoleConfirm(reason) {
    try {
      await updateAdminUserRole(actionState.userId, {
        role: actionState.value,
        reason,
        confirmSelfDowngrade: actionState.confirmSelfDowngrade
      });
      toast.success('User role updated');
      setActionState(null);
      await loadUsers();
      if (selectedUserId === actionState.userId) {
        const refreshed = await fetchAdminUserDetails(actionState.userId);
        setSelectedUser(refreshed);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update role');
    }
  }

  async function handleStatusConfirm(reason) {
    try {
      await updateAdminUserStatus(actionState.userId, {
        status: actionState.value,
        reason
      });
      toast.success('User status updated');
      setActionState(null);
      await loadUsers();
      if (selectedUserId === actionState.userId) {
        const refreshed = await fetchAdminUserDetails(actionState.userId);
        setSelectedUser(refreshed);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update account status');
    }
  }

  async function handleLiveSessionResetConfirm(reason) {
    try {
      await resetAdminMentorLiveSessions(actionState.userId, { reason });
      toast.success('Mentor panel live sessions reset to 0');
      const currentId = actionState.userId;
      setActionState(null);
      await loadUsers();
      if (selectedUserId === currentId) {
        const refreshed = await fetchAdminUserDetails(currentId);
        setSelectedUser(refreshed);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to reset live sessions');
    }
  }

  async function handleDeleteUserConfirm(reason) {
    try {
      await deleteAdminUser(actionState.userId, { reason });
      toast.success('User and all associated data permanently deleted');
      const deletedId = actionState.userId;
      setActionState(null);
      await loadUsers();
      if (selectedUserId === deletedId) {
        setSelectedUserId('');
        setSelectedUser(null);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete user');
    }
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        title="User Management"
        description="Search, filter, inspect, and control platform accounts without touching the student or teacher experiences."
        badge={{ label: `${pagination.total} users`, tone: 'info' }}
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
            <span>Role</span>
            <select value={filters.role} onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value, page: 1 }))}>
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
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
            <span>Created from</span>
            <input type="date" value={filters.createdFrom} onChange={(event) => setFilters((prev) => ({ ...prev, createdFrom: event.target.value, page: 1 }))} />
          </label>

          <label className="admin-field">
            <span>Created to</span>
            <input type="date" value={filters.createdTo} onChange={(event) => setFilters((prev) => ({ ...prev, createdTo: event.target.value, page: 1 }))} />
          </label>
        </div>

        {loading ? (
          <div className="admin-page-loader"><div className="admin-spinner" /><p>Loading users...</p></div>
        ) : users.length === 0 ? (
          <AdminEmptyState
            title="No users matched these filters"
            description="Try broadening the role, status, or created date filters."
          />
        ) : (
          <>
            <AdminTable
              columns={['Name', 'Email', 'Phone', 'Role', 'Status', 'Created', 'Last active', 'Actions']}
              minWidth={1100}
            >
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <button type="button" className="admin-link-button" onClick={() => openUser(user.id)}>
                      {user.name || 'Unnamed user'}
                    </button>
                  </td>
                  <td>{user.email}</td>
                  <td>{user.phoneNumber || 'N/A'}</td>
                  <td><AdminBadge tone={toneForRole(user.role)}>{user.role}</AdminBadge></td>
                  <td><AdminBadge tone={toneForStatus(user.accountStatus)}>{user.accountStatus}</AdminBadge></td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>{formatDate(user.lastActiveAt)}</td>
                  <td>
                    <div className="admin-table__actions">
                      <AdminActionButton variant="ghost" onClick={() => openUser(user.id)}>
                        View
                      </AdminActionButton>

                      {['tutor', 'teacher'].includes(user.baseRole) ? (
                        <AdminActionButton
                          tone="warning"
                          variant="ghost"
                          onClick={() => {
                            setActionState({
                              type: 'liveSessionsReset',
                              userId: user.id,
                              title: `Reset mentor panel live sessions for ${user.name || 'this user'}?`,
                              description: 'This sets the mentor panel weekly usage back to 0 and allows this mentor to start live classes again this week.'
                            });
                          }}
                        >
                          Reset mentor sessions
                        </AdminActionButton>
                      ) : null}

                      <AdminActionButton
                        tone="danger"
                        variant="ghost"
                        onClick={() => {
                          setActionState({
                            type: 'delete',
                            userId: user.id,
                            title: `Permanently delete ${user.name || 'this user'}?`,
                            description: 'WARNING: This will permanently delete the user account and EVERY record associated with them in the system (live sessions, posts, comments, payments, bookmarks, and highlight history). This action is irreversible.'
                          });
                        }}
                      >
                        Delete
                      </AdminActionButton>

                      <select
                        value=""
                        onChange={(event) => {
                          const nextRole = event.target.value;
                          if (!nextRole) return;
                          setActionState({
                            type: 'role',
                            userId: user.id,
                            value: nextRole,
                            title: `Change role for ${user.name}?`,
                            description: `This will change the user's effective role to "${nextRole}".`,
                            confirmSelfDowngrade: user.role === 'admin' && nextRole !== 'admin'
                          });
                          event.target.value = '';
                        }}
                      >
                        <option value="">Change role</option>
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>

                      <select
                        value=""
                        onChange={(event) => {
                          const nextStatus = event.target.value;
                          if (!nextStatus) return;
                          setActionState({
                            type: 'status',
                            userId: user.id,
                            value: nextStatus,
                            title: `Update status for ${user.name}?`,
                            description: `This will set the account status to "${nextStatus}".`
                          });
                          event.target.value = '';
                        }}
                      >
                        <option value="">Change status</option>
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
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

      <AdminUserDetailsDrawer
        user={selectedUser}
        open={activeDrawer}
        loading={detailsLoading}
        onClose={() => {
          setSelectedUserId('');
          setSelectedUser(null);
        }}
        onLiveSessionReset={() => {
          setActionState({
            type: 'liveSessionsReset',
            userId: selectedUserId,
            title: `Reset mentor panel live sessions for ${selectedUser?.name || 'this user'}?`,
            description: 'This sets the mentor panel weekly usage back to 0 and allows this mentor to start live classes again this week.'
          });
        }}
      />

      <AdminConfirmModal
        open={actionState?.type === 'role'}
        title={actionState?.title}
        description={actionState?.description}
        confirmLabel="Update role"
        onClose={() => setActionState(null)}
        onConfirm={handleRoleConfirm}
      />

      <AdminConfirmModal
        open={actionState?.type === 'status'}
        title={actionState?.title}
        description={actionState?.description}
        requireReason={actionState?.value === 'banned' || actionState?.value === 'suspended'}
        reasonLabel="Reason"
        confirmLabel="Update status"
        onClose={() => setActionState(null)}
        onConfirm={handleStatusConfirm}
      />

      <AdminConfirmModal
        open={actionState?.type === 'liveSessionsReset'}
        title={actionState?.title}
        description={actionState?.description}
        confirmLabel="Reset to 0"
        onClose={() => setActionState(null)}
        onConfirm={handleLiveSessionResetConfirm}
      />

      <AdminConfirmModal
        open={actionState?.type === 'delete'}
        title={actionState?.title}
        description={actionState?.description}
        requireReason={true}
        reasonLabel="Reason for deletion"
        confirmLabel="Permanently Delete User"
        onClose={() => setActionState(null)}
        onConfirm={handleDeleteUserConfirm}
      />
    </section>
  );
}
