import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminActionButton from '../components/AdminActionButton';
import AdminBadge from '../components/AdminBadge';
import AdminConfirmModal from '../components/AdminConfirmModal';
import AdminContestAttemptDrawer from '../components/AdminContestAttemptDrawer';
import AdminContestDetailsDrawer from '../components/AdminContestDetailsDrawer';
import AdminContestFormModal from '../components/AdminContestFormModal';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPagination from '../components/AdminPagination';
import AdminStatCard from '../components/AdminStatCard';
import AdminTable from '../components/AdminTable';
import {
  addAdminAttemptReviewNote,
  archiveAdminContest,
  cancelAdminContest,
  clearAdminAttemptFlag,
  createAdminContest,
  fetchAdminAttemptDetails,
  fetchAdminContestDetails,
  fetchAdminContests,
  fetchAdminLiveContestParticipants,
  fetchAdminLiveContestSummary,
  fetchAdminSuspiciousAttempts,
  flagAdminAttempt,
  updateAdminContest
} from '../services/adminApi';

const ADMIN_STATUS_OPTIONS = ['active', 'archived', 'cancelled'];
const LIFECYCLE_OPTIONS = ['upcoming', 'live', 'completed', 'cancelled', 'archived'];
const LEVEL_OPTIONS = ['hsc', 'admission'];
const QUESTION_TYPE_OPTIONS = ['mcq', 'cq', 'both'];
const ANTI_CHEAT_STATUS_OPTIONS = ['flagged', 'cleared'];

function formatDateTime(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function formatDuration(seconds) {
  const safe = Number(seconds) || 0;
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${minutes}m ${remaining}s`;
}

function formatCoverage(contest) {
  if (contest.level === 'admission') {
    return [contest.admissionType, contest.admissionSubtype].filter(Boolean).join(' / ') || 'Admission';
  }
  return (contest.subjects || []).join(', ') || 'N/A';
}

function toneForAdminStatus(status) {
  if (status === 'active') return 'success';
  if (status === 'archived') return 'neutral';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

function toneForLifecycle(status) {
  if (status === 'live') return 'success';
  if (status === 'upcoming') return 'info';
  if (status === 'completed') return 'neutral';
  if (status === 'archived') return 'neutral';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

function toneForAttemptStatus(status) {
  if (status === 'completed') return 'success';
  if (status === 'in_progress') return 'info';
  if (status === 'disqualified') return 'danger';
  return 'neutral';
}

function toneForFlagStatus(status) {
  if (status === 'flagged') return 'warning';
  if (status === 'cleared') return 'success';
  return 'neutral';
}

function toneForReviewStatus(status) {
  if (status === 'under_review') return 'info';
  if (status === 'detected') return 'warning';
  if (status === 'cleared') return 'success';
  return 'neutral';
}

function buildContestActionState(contestId, status, contestName) {
  if (status === 'cancelled') {
    return {
      entity: 'contest',
      contestId,
      action: 'cancel',
      title: `Cancel ${contestName}?`,
      description: 'Cancellation keeps participant history and leaderboard data intact, but blocks further registrations and submissions.',
      requireReason: true
    };
  }
  if (status === 'archived') {
    return {
      entity: 'contest',
      contestId,
      action: 'archive',
      title: `Archive ${contestName}?`,
      description: 'Archived contests are removed from active contest discovery while preserving historical attempts and results.'
    };
  }
  return {
    entity: 'contest',
    contestId,
    action: 'restore',
    title: `Restore ${contestName}?`,
    description: 'This returns the contest to the normal active contest flow.'
  };
}

function buildAttemptActionState(resultId, action, label) {
  if (action === 'flag') {
    return {
      entity: 'attempt',
      resultId,
      action,
      title: `Flag ${label}?`,
      description: 'This keeps the attempt intact but marks it for anti-cheat review.',
      requireReason: true
    };
  }
  return {
    entity: 'attempt',
    resultId,
    action,
    title: `Clear ${label}?`,
    description: 'This keeps the attempt intact and records that the admin has cleared the suspicious flag.'
  };
}

export default function AdminContestsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname.endsWith('/live')
    ? 'live'
    : location.pathname.endsWith('/anti-cheat')
      ? 'anti-cheat'
      : 'all';

  const [filters, setFilters] = useState({
    search: '',
    adminStatus: '',
    lifecycle: '',
    level: '',
    questionType: '',
    createdBy: '',
    startDateFrom: '',
    startDateTo: '',
    page: 1,
    limit: 10
  });
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ active: 0, archived: 0, cancelled: 0 });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const [liveFilters, setLiveFilters] = useState({
    search: '',
    contestId: '',
    page: 1,
    limit: 20
  });
  const [liveSummary, setLiveSummary] = useState([]);
  const [liveParticipants, setLiveParticipants] = useState([]);
  const [livePagination, setLivePagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [liveLoading, setLiveLoading] = useState(true);

  const [antiCheatFilters, setAntiCheatFilters] = useState({
    search: '',
    status: '',
    contestId: '',
    page: 1,
    limit: 20
  });
  const [suspiciousItems, setSuspiciousItems] = useState([]);
  const [antiCheatPagination, setAntiCheatPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [antiCheatLoading, setAntiCheatLoading] = useState(true);

  const [selectedContestId, setSelectedContestId] = useState('');
  const [selectedContest, setSelectedContest] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [selectedAttemptId, setSelectedAttemptId] = useState('');
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [attemptDetailsLoading, setAttemptDetailsLoading] = useState(false);

  const [actionState, setActionState] = useState(null);
  const [formState, setFormState] = useState({ open: false, mode: 'create' });

  async function loadContestData(nextFilters = filters) {
    try {
      setLoading(true);
      const data = await fetchAdminContests(nextFilters);
      setItems(data?.items || []);
      setStats(data?.stats || { active: 0, archived: 0, cancelled: 0 });
      setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      toast.error(err.message || 'Failed to load contests');
    } finally {
      setLoading(false);
    }
  }

  async function loadLiveData(nextFilters = liveFilters) {
    try {
      setLiveLoading(true);
      const [summaryData, participantsData] = await Promise.all([
        fetchAdminLiveContestSummary({ search: nextFilters.search }),
        fetchAdminLiveContestParticipants(nextFilters)
      ]);
      setLiveSummary(summaryData?.items || []);
      setLiveParticipants(participantsData?.items || []);
      setLivePagination(participantsData?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      toast.error(err.message || 'Failed to load live monitoring');
    } finally {
      setLiveLoading(false);
    }
  }

  async function loadAntiCheatData(nextFilters = antiCheatFilters) {
    try {
      setAntiCheatLoading(true);
      const data = await fetchAdminSuspiciousAttempts(nextFilters);
      setSuspiciousItems(data?.items || []);
      setAntiCheatPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      toast.error(err.message || 'Failed to load suspicious attempts');
    } finally {
      setAntiCheatLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab !== 'all') return undefined;
    const timeout = setTimeout(() => {
      loadContestData(filters);
    }, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filters.page, filters.adminStatus, filters.lifecycle, filters.level, filters.questionType, filters.startDateFrom, filters.startDateTo]);

  useEffect(() => {
    if (activeTab !== 'all') return undefined;
    const timeout = setTimeout(() => {
      loadContestData({ ...filters, page: 1 });
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filters.search, filters.createdBy]);

  useEffect(() => {
    if (activeTab !== 'live') return undefined;
    const timeout = setTimeout(() => {
      loadLiveData(liveFilters);
    }, 0);
    const interval = setInterval(() => {
      loadLiveData(liveFilters);
    }, 15000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, liveFilters.page, liveFilters.contestId]);

  useEffect(() => {
    if (activeTab !== 'live') return undefined;
    const timeout = setTimeout(() => {
      loadLiveData({ ...liveFilters, page: 1 });
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, liveFilters.search]);

  useEffect(() => {
    if (activeTab !== 'anti-cheat') return undefined;
    const timeout = setTimeout(() => {
      loadAntiCheatData(antiCheatFilters);
    }, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, antiCheatFilters.page, antiCheatFilters.status, antiCheatFilters.contestId]);

  useEffect(() => {
    if (activeTab !== 'anti-cheat') return undefined;
    const timeout = setTimeout(() => {
      loadAntiCheatData({ ...antiCheatFilters, page: 1 });
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, antiCheatFilters.search]);

  async function openContest(contestId) {
    setSelectedContestId(contestId);
    setDetailsLoading(true);
    try {
      const data = await fetchAdminContestDetails(contestId);
      setSelectedContest(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load contest details');
    } finally {
      setDetailsLoading(false);
    }
  }

  async function refreshSelectedContest(contestId = selectedContestId) {
    if (!contestId) return;
    const data = await fetchAdminContestDetails(contestId);
    setSelectedContest(data);
  }

  async function openAttempt(resultId) {
    setSelectedAttemptId(resultId);
    setAttemptDetailsLoading(true);
    try {
      const data = await fetchAdminAttemptDetails(resultId);
      setSelectedAttempt(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load attempt details');
    } finally {
      setAttemptDetailsLoading(false);
    }
  }

  async function refreshSelectedAttempt(resultId = selectedAttemptId) {
    if (!resultId) return;
    const data = await fetchAdminAttemptDetails(resultId);
    setSelectedAttempt(data);
  }

  async function handleActionConfirm(reason) {
    try {
      if (actionState?.entity === 'contest') {
        if (actionState.action === 'cancel') {
          await cancelAdminContest(actionState.contestId, { reason });
          toast.success('Contest cancelled');
        } else if (actionState.action === 'archive') {
          await archiveAdminContest(actionState.contestId, { reason });
          toast.success('Contest archived');
        } else if (actionState.action === 'restore') {
          await updateAdminContest(actionState.contestId, { reason, adminStatus: 'active' });
          toast.success('Contest restored');
        }
        const currentContestId = actionState.contestId;
        setActionState(null);
        await loadContestData();
        if (selectedContestId === currentContestId) {
          await refreshSelectedContest(currentContestId);
        }
        return;
      }

      if (actionState?.entity === 'attempt') {
        if (actionState.action === 'flag') {
          await flagAdminAttempt(actionState.resultId, { reason });
          toast.success('Attempt flagged');
        } else if (actionState.action === 'clear') {
          await clearAdminAttemptFlag(actionState.resultId, { reason });
          toast.success('Attempt cleared');
        }
        const currentResultId = actionState.resultId;
        setActionState(null);
        await loadAntiCheatData();
        await loadLiveData();
        if (selectedAttemptId === currentResultId) {
          await refreshSelectedAttempt(currentResultId);
        }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update item');
    }
  }

  async function handleFormSubmit(payload) {
    try {
      if (formState.mode === 'create') {
        const created = await createAdminContest(payload);
        toast.success('Contest created');
        setFormState({ open: false, mode: 'create' });
        await loadContestData();
        if (created?.id || created?.data?.id) {
          await openContest(created?.id || created?.data?.id);
        }
        return;
      }

      const { adminStatus, reason, ...updatePayload } = payload;
      const updated = await updateAdminContest(formState.contestId, {
        ...updatePayload,
        reason
      });
      if (adminStatus === 'cancelled') {
        await cancelAdminContest(formState.contestId, { reason: reason || 'Cancelled during admin edit' });
      } else if (adminStatus === 'archived') {
        await archiveAdminContest(formState.contestId, { reason });
      } else if (selectedContest?.adminStatus && selectedContest.adminStatus !== 'active') {
        await updateAdminContest(formState.contestId, { reason, adminStatus: 'active' });
      }
      toast.success('Contest updated');
      setFormState({ open: false, mode: 'create' });
      await loadContestData();
      await refreshSelectedContest(formState.contestId || updated?.id || updated?.data?.id);
    } catch (err) {
      toast.error(err.message || 'Failed to save contest');
    }
  }

  async function handleSaveReviewNote(resultId, note) {
    if (!note) {
      toast.error('Review note is required');
      return;
    }
    try {
      await addAdminAttemptReviewNote(resultId, { note });
      toast.success('Review note saved');
      await loadAntiCheatData();
      if (selectedAttemptId === resultId) {
        await refreshSelectedAttempt(resultId);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save review note');
    }
  }

  const contestHeaderBadge = useMemo(() => `${pagination.total} contests`, [pagination.total]);
  const liveHeaderBadge = useMemo(() => `${liveSummary.length} live contests`, [liveSummary.length]);
  const antiCheatHeaderBadge = useMemo(() => `${antiCheatPagination.total} flagged or detected attempts`, [antiCheatPagination.total]);

  const liveStats = useMemo(() => {
    const totalParticipants = liveSummary.reduce((sum, item) => sum + (item.totalParticipantsCount || 0), 0);
    const activeParticipants = liveSummary.reduce((sum, item) => sum + (item.activeParticipantsCount || 0), 0);
    const submissions = liveSummary.reduce((sum, item) => sum + (item.submissionsCount || 0), 0);
    return { totalParticipants, activeParticipants, submissions };
  }, [liveSummary]);

  function renderTabs() {
    const tabs = [
      { id: 'all', label: 'All Contests', to: '/admin/contests' },
      { id: 'live', label: 'Live Monitoring', to: '/admin/contests/live' },
      { id: 'anti-cheat', label: 'Anti-Cheat Review', to: '/admin/contests/anti-cheat' }
    ];
    return (
      <div className="admin-chip-row" style={{ marginBottom: 20 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`admin-button ${activeTab === tab.id ? '' : 'admin-button--ghost'}`}
            onClick={() => navigate(tab.to)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  function renderContestControlTab() {
    return (
      <>
        <AdminPageHeader
          title="Contest Control"
          description="View, create, edit, cancel, and archive contests while reusing the existing platform contest system and keeping student Battle/Contest behavior intact."
          badge={{ label: contestHeaderBadge, tone: 'info' }}
          actions={(
            <AdminActionButton onClick={() => setFormState({ open: true, mode: 'create' })}>
              Create contest
            </AdminActionButton>
          )}
        />

        {renderTabs()}

        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Contest queue</h3>
              <p className="admin-panel__subtext">This page works on the same `Contest` and `ContestResult` data already used by the student and teacher contest flows.</p>
            </div>
            <div className="admin-chip-row">
              <AdminBadge tone="success" size="sm">{stats.active || 0} active</AdminBadge>
              <AdminBadge tone="neutral" size="sm">{stats.archived || 0} archived</AdminBadge>
              <AdminBadge tone="danger" size="sm">{stats.cancelled || 0} cancelled</AdminBadge>
            </div>
          </div>

          <div className="admin-toolbar">
            <label className="admin-field admin-field--search">
              <span>Search</span>
              <input value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))} placeholder="Search title or creator" />
            </label>
            <label className="admin-field">
              <span>Status</span>
              <select value={filters.adminStatus} onChange={(event) => setFilters((prev) => ({ ...prev, adminStatus: event.target.value, page: 1 }))}>
                <option value="">All statuses</option>
                {ADMIN_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="admin-field">
              <span>Lifecycle</span>
              <select value={filters.lifecycle} onChange={(event) => setFilters((prev) => ({ ...prev, lifecycle: event.target.value, page: 1 }))}>
                <option value="">All lifecycles</option>
                {LIFECYCLE_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="admin-field">
              <span>Level</span>
              <select value={filters.level} onChange={(event) => setFilters((prev) => ({ ...prev, level: event.target.value, page: 1 }))}>
                <option value="">All levels</option>
                {LEVEL_OPTIONS.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </label>
            <label className="admin-field">
              <span>Type</span>
              <select value={filters.questionType} onChange={(event) => setFilters((prev) => ({ ...prev, questionType: event.target.value, page: 1 }))}>
                <option value="">All types</option>
                {QUESTION_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="admin-field">
              <span>Created by</span>
              <input value={filters.createdBy} onChange={(event) => setFilters((prev) => ({ ...prev, createdBy: event.target.value, page: 1 }))} placeholder="Creator name or email" />
            </label>
            <label className="admin-field">
              <span>Start from</span>
              <input type="date" value={filters.startDateFrom} onChange={(event) => setFilters((prev) => ({ ...prev, startDateFrom: event.target.value, page: 1 }))} />
            </label>
            <label className="admin-field">
              <span>Start to</span>
              <input type="date" value={filters.startDateTo} onChange={(event) => setFilters((prev) => ({ ...prev, startDateTo: event.target.value, page: 1 }))} />
            </label>
          </div>

          {loading ? (
            <div className="admin-page-loader"><div className="admin-spinner" /><p>Loading contests...</p></div>
          ) : items.length === 0 ? (
            <AdminEmptyState title="No contests found" description="Try broadening the search, creator, lifecycle, or date filters to inspect more contest records." />
          ) : (
            <>
              <AdminTable columns={['Contest title', 'Type / Category', 'Start time', 'End time', 'Participants', 'Submissions', 'Status', 'Created by', 'Created date', 'Actions']} minWidth={1440}>
                {items.map((contest) => (
                  <tr key={contest.id}>
                    <td>
                      <button type="button" className="admin-link-button" onClick={() => openContest(contest.id)}>{contest.title}</button>
                      <div className="admin-table__muted">{contest.questionCount || 0} questions</div>
                    </td>
                    <td>
                      <strong>{contest.type || 'N/A'}</strong>
                      <div className="admin-table__muted">{formatCoverage(contest)}</div>
                    </td>
                    <td>{formatDateTime(contest.startDate)}</td>
                    <td>{formatDateTime(contest.endDate)}</td>
                    <td>{contest.participantCount || 0}</td>
                    <td>{contest.submissionsCount || 0}</td>
                    <td>
                      <div className="admin-chip-row">
                        <AdminBadge tone={toneForLifecycle(contest.lifecycle)}>{contest.lifecycle}</AdminBadge>
                        <AdminBadge tone={toneForAdminStatus(contest.adminStatus)}>{contest.adminStatus}</AdminBadge>
                      </div>
                    </td>
                    <td>
                      <strong>{contest.creator?.name || 'Unknown creator'}</strong>
                      <div className="admin-table__muted">{contest.creator?.email || 'N/A'}</div>
                    </td>
                    <td>{formatDateTime(contest.createdAt)}</td>
                    <td>
                      <div className="admin-table__actions">
                        <AdminActionButton variant="ghost" onClick={() => openContest(contest.id)}>View</AdminActionButton>
                        <AdminActionButton variant="ghost" onClick={() => setFormState({ open: true, mode: 'edit', contestId: contest.id, contest })}>Edit</AdminActionButton>
                        {contest.adminStatus !== 'archived' ? (
                          <AdminActionButton variant="ghost" onClick={() => setActionState(buildContestActionState(contest.id, 'archived', contest.title))}>Archive</AdminActionButton>
                        ) : null}
                        {contest.adminStatus !== 'cancelled' ? (
                          <AdminActionButton tone="danger" variant="ghost" onClick={() => setActionState(buildContestActionState(contest.id, 'cancelled', contest.title))}>Cancel</AdminActionButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </AdminTable>
              <AdminPagination page={pagination.page} totalPages={pagination.totalPages} onChange={(page) => setFilters((prev) => ({ ...prev, page }))} />
            </>
          )}
        </section>
      </>
    );
  }

  function renderLiveMonitoringTab() {
    return (
      <>
        <AdminPageHeader
          title="Live Contest Monitoring"
          description="Monitor currently live contests using the existing contest result stream and contest-linked practice history when available."
          badge={{ label: liveHeaderBadge, tone: 'success' }}
          actions={<AdminActionButton variant="ghost" onClick={() => loadLiveData()}>{liveLoading ? 'Refreshing...' : 'Refresh'}</AdminActionButton>}
        />
        {renderTabs()}

        <section className="admin-stats-grid">
          <AdminStatCard label="Live contests" value={liveSummary.length} hint="Currently active contest windows" tone="success" />
          <AdminStatCard label="Active participants" value={liveStats.activeParticipants} hint="Derived from in-progress result rows" tone="info" />
          <AdminStatCard label="Registered participants" value={liveStats.totalParticipants} hint="Across all live contests" tone="neutral" />
          <AdminStatCard label="Saved submissions" value={liveStats.submissions} hint="Intermediate or completed result saves" tone="warning" />
        </section>

        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Live contests summary</h3>
              <p className="admin-panel__subtext">This uses existing contest time windows and saved leaderboard progress rather than a separate real-time admin transport.</p>
            </div>
          </div>

          <div className="admin-toolbar">
            <label className="admin-field admin-field--search">
              <span>Search</span>
              <input value={liveFilters.search} onChange={(event) => setLiveFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))} placeholder="Search live contest or participant" />
            </label>
            <label className="admin-field">
              <span>Contest</span>
              <select value={liveFilters.contestId} onChange={(event) => setLiveFilters((prev) => ({ ...prev, contestId: event.target.value, page: 1 }))}>
                <option value="">All live contests</option>
                {liveSummary.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
          </div>

          {liveLoading ? (
            <div className="admin-page-loader"><div className="admin-spinner" /><p>Loading live monitoring...</p></div>
          ) : liveSummary.length === 0 ? (
            <AdminEmptyState title="No live contests right now" description="When a contest is actively running, its live summary and participant progress will appear here." />
          ) : (
            <>
              <AdminTable columns={['Contest', 'Status', 'Start', 'End', 'Time remaining', 'Active participants', 'Total participants', 'Submissions', 'Average score', 'Completed']} minWidth={1440}>
                {liveSummary.map((item) => (
                  <tr key={item.id}>
                    <td><button type="button" className="admin-link-button" onClick={() => openContest(item.id)}>{item.title}</button></td>
                    <td><AdminBadge tone="success">{item.status}</AdminBadge></td>
                    <td>{formatDateTime(item.startTime)}</td>
                    <td>{formatDateTime(item.endTime)}</td>
                    <td>{formatDuration(item.timeRemainingSeconds)}</td>
                    <td>{item.activeParticipantsCount || 0}</td>
                    <td>{item.totalParticipantsCount || 0}</td>
                    <td>{item.submissionsCount || 0}</td>
                    <td>{item.averageScore}</td>
                    <td>{item.completionCount || 0}</td>
                  </tr>
                ))}
              </AdminTable>

              <div className="admin-panel" style={{ marginTop: 16 }}>
                <div className="admin-panel__header">
                  <div>
                    <h3>Live participant progress</h3>
                    <p className="admin-panel__subtext">Progress rows come from the same contest result saves the student experience already uses.</p>
                  </div>
                </div>
                <AdminTable columns={['Participant', 'Contest', 'Attempt status', 'Started at', 'Submitted at', 'Time spent', 'Score', 'Progress', 'Actions']} minWidth={1380}>
                  {liveParticipants.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.participant?.name || 'Unknown participant'}</strong>
                        <div className="admin-table__muted">{item.participant?.email || 'N/A'}</div>
                      </td>
                      <td>{item.contestTitle}</td>
                      <td><AdminBadge tone={toneForAttemptStatus(item.attemptStatus)}>{item.attemptStatus}</AdminBadge></td>
                      <td>{formatDateTime(item.startedAt)}</td>
                      <td>{formatDateTime(item.submittedAt)}</td>
                      <td>{formatDuration(item.durationSeconds)}</td>
                      <td>{item.score} / {item.totalQuestions}</td>
                      <td>{item.progress}%</td>
                      <td>
                        <div className="admin-table__actions">
                          <AdminActionButton variant="ghost" onClick={() => openAttempt(item.id)}>View attempt</AdminActionButton>
                          <AdminActionButton variant="ghost" onClick={() => setActionState(buildAttemptActionState(item.id, 'flag', item.participant?.name || 'this attempt'))}>
                            Flag
                          </AdminActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </AdminTable>
                <AdminPagination page={livePagination.page} totalPages={livePagination.totalPages} onChange={(page) => setLiveFilters((prev) => ({ ...prev, page }))} />
              </div>
            </>
          )}
        </section>
      </>
    );
  }

  function renderAntiCheatTab() {
    return (
      <>
        <AdminPageHeader
          title="Anti-Cheat Review"
          description="Review suspicious contest attempts using only signals that already exist in contest results, contest timing, and linked practice attempt data."
          badge={{ label: antiCheatHeaderBadge, tone: 'warning' }}
        />
        {renderTabs()}

        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Suspicious attempts</h3>
              <p className="admin-panel__subtext">Invalidation is intentionally not enabled in Phase 7B because the current contest system does not support a safe, reversible result-invalidating workflow yet.</p>
            </div>
          </div>

          <div className="admin-toolbar">
            <label className="admin-field admin-field--search">
              <span>Search</span>
              <input value={antiCheatFilters.search} onChange={(event) => setAntiCheatFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))} placeholder="Search user, contest, or signal" />
            </label>
            <label className="admin-field">
              <span>Flag status</span>
              <select value={antiCheatFilters.status} onChange={(event) => setAntiCheatFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))}>
                <option value="">All detected attempts</option>
                {ANTI_CHEAT_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="admin-field">
              <span>Contest</span>
              <select value={antiCheatFilters.contestId} onChange={(event) => setAntiCheatFilters((prev) => ({ ...prev, contestId: event.target.value, page: 1 }))}>
                <option value="">All contests</option>
                {items.map((contest) => <option key={contest.id} value={contest.id}>{contest.title}</option>)}
              </select>
            </label>
          </div>

          {antiCheatLoading ? (
            <div className="admin-page-loader"><div className="admin-spinner" /><p>Loading suspicious attempts...</p></div>
          ) : suspiciousItems.length === 0 ? (
            <AdminEmptyState title="No suspicious attempts detected" description="This clean state means no attempts currently match the Phase 7B anti-cheat rules or saved admin flags." />
          ) : (
            <>
              <AdminTable columns={['User', 'Contest', 'Score', 'Duration', 'Attempt count', 'Suspicious reason', 'Flag status', 'Reviewed status', 'Submitted', 'Actions']} minWidth={1520}>
                {suspiciousItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.user?.name || 'Unknown user'}</strong>
                      <div className="admin-table__muted">{item.user?.email || 'N/A'}</div>
                    </td>
                    <td>{item.contest?.title || 'Unknown contest'}</td>
                    <td>{item.score} / {item.totalQuestions}</td>
                    <td>{formatDuration(item.durationSeconds)}</td>
                    <td>{item.attemptCount || 0}</td>
                    <td>{item.suspiciousReasons.join(', ') || 'Manual review'}</td>
                    <td><AdminBadge tone={toneForFlagStatus(item.flagStatus)}>{item.flagStatus}</AdminBadge></td>
                    <td><AdminBadge tone={toneForReviewStatus(item.reviewedStatus)}>{item.reviewedStatus}</AdminBadge></td>
                    <td>{formatDateTime(item.submittedAt)}</td>
                    <td>
                      <div className="admin-table__actions">
                        <AdminActionButton variant="ghost" onClick={() => openAttempt(item.id)}>View</AdminActionButton>
                        <AdminActionButton variant="ghost" onClick={() => setActionState(buildAttemptActionState(item.id, 'flag', item.user?.name || 'this attempt'))}>Flag</AdminActionButton>
                        <AdminActionButton variant="ghost" onClick={() => setActionState(buildAttemptActionState(item.id, 'clear', item.user?.name || 'this attempt'))}>Clear</AdminActionButton>
                        <AdminActionButton variant="ghost" onClick={() => openAttempt(item.id)}>Add Note</AdminActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </AdminTable>
              <AdminPagination page={antiCheatPagination.page} totalPages={antiCheatPagination.totalPages} onChange={(page) => setAntiCheatFilters((prev) => ({ ...prev, page }))} />
            </>
          )}
        </section>
      </>
    );
  }

  return (
    <section className="admin-page">
      {activeTab === 'live' ? renderLiveMonitoringTab() : activeTab === 'anti-cheat' ? renderAntiCheatTab() : renderContestControlTab()}

      <AdminContestDetailsDrawer
        contest={selectedContest}
        open={Boolean(selectedContestId)}
        loading={detailsLoading}
        onClose={() => {
          setSelectedContestId('');
          setSelectedContest(null);
        }}
        onSetStatus={(status) => setActionState(buildContestActionState(selectedContestId, status, selectedContest?.title || selectedContest?.name || 'this contest'))}
        onEdit={() => setFormState({ open: true, mode: 'edit', contestId: selectedContestId, contest: selectedContest })}
      />

      <AdminContestAttemptDrawer
        attempt={selectedAttempt}
        open={Boolean(selectedAttemptId)}
        loading={attemptDetailsLoading}
        onClose={() => {
          setSelectedAttemptId('');
          setSelectedAttempt(null);
        }}
        onFlag={(resultId) => setActionState(buildAttemptActionState(resultId, 'flag', selectedAttempt?.user?.name || 'this attempt'))}
        onClear={(resultId) => setActionState(buildAttemptActionState(resultId, 'clear', selectedAttempt?.user?.name || 'this attempt'))}
        onSaveNote={handleSaveReviewNote}
      />

      {formState.open ? (
        <AdminContestFormModal
          open={formState.open}
          mode={formState.mode}
          contest={formState.mode === 'edit' ? (formState.contest || selectedContest) : null}
          cloneOptions={items.map((item) => ({ id: item.id, name: item.title }))}
          onClose={() => setFormState({ open: false, mode: 'create' })}
          onSubmit={handleFormSubmit}
        />
      ) : null}

      <AdminConfirmModal
        open={Boolean(actionState)}
        title={actionState?.title || ''}
        description={actionState?.description || ''}
        requireReason={Boolean(actionState?.requireReason)}
        reasonLabel={actionState?.entity === 'attempt' ? 'Review reason' : 'Admin reason'}
        confirmLabel={
          actionState?.entity === 'attempt'
            ? actionState?.action === 'flag'
              ? 'Flag attempt'
              : 'Clear flag'
            : actionState?.action === 'cancel'
              ? 'Cancel contest'
              : actionState?.action === 'archive'
                ? 'Archive contest'
                : 'Restore contest'
        }
        onClose={() => setActionState(null)}
        onConfirm={handleActionConfirm}
      />
    </section>
  );
}
