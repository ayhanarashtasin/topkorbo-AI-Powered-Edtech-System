import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminActionButton from '../components/AdminActionButton';
import AdminBadge from '../components/AdminBadge';
import AdminConfirmModal from '../components/AdminConfirmModal';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminLoadingState from '../components/AdminLoadingState';
import AdminModerationAppealDrawer from '../components/AdminModerationAppealDrawer';
import AdminModerationReportDrawer from '../components/AdminModerationReportDrawer';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPagination from '../components/AdminPagination';
import AdminStatCard from '../components/AdminStatCard';
import AdminTable from '../components/AdminTable';
import {
  addAdminModerationAppealNote,
  addAdminModerationReportNote,
  approveAdminModerationAppeal,
  dismissAdminModerationReport,
  fetchAdminModerationAppealDetails,
  fetchAdminModerationAppeals,
  fetchAdminModerationReportDetails,
  fetchAdminModerationReports,
  hideAdminModerationReportContent,
  markAdminModerationReportUnderReview,
  rejectAdminModerationAppeal,
  resolveAdminModerationReport,
  updateAdminModerationReportUserStatus,
  warnAdminModerationReportUser
} from '../services/adminApi';

const REPORT_STATUS_OPTIONS = ['open', 'under_review', 'resolved', 'dismissed'];
const REPORT_TYPE_OPTIONS = ['post', 'comment', 'user', 'question'];
const REPORT_REASON_OPTIONS = [
  'spam',
  'harassment',
  'hate',
  'nudity',
  'misinformation',
  'cheating',
  'wrong_answer',
  'wrong_explanation',
  'typo',
  'duplicate',
  'outdated',
  'other'
];
const APPEAL_STATUS_OPTIONS = ['pending', 'under_review', 'approved', 'rejected'];

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
  if (status === 'banned' || status === 'rejected') return 'danger';
  if (status === 'resolved' || status === 'approved') return 'success';
  if (status === 'under_review') return 'info';
  if (status === 'dismissed') return 'neutral';
  if (status === 'open' || status === 'pending') return 'warning';
  return 'neutral';
}

function getViewFromPath(pathname) {
  if (pathname.endsWith('/appeals')) return 'appeals';
  return 'reports';
}

export default function AdminModerationPage() {
  const location = useLocation();
  const activeView = useMemo(() => getViewFromPath(location.pathname), [location.pathname]);
  const [reportFilters, setReportFilters] = useState({
    search: '',
    status: '',
    itemType: '',
    reason: '',
    createdFrom: '',
    createdTo: '',
    page: 1,
    limit: 10
  });
  const [appealFilters, setAppealFilters] = useState({
    search: '',
    status: '',
    createdFrom: '',
    createdTo: '',
    page: 1,
    limit: 10
  });
  const [reports, setReports] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [reportSummary, setReportSummary] = useState({ total: 0, open: 0, under_review: 0, resolved: 0, dismissed: 0 });
  const [appealSummary, setAppealSummary] = useState({ total: 0, pending: 0, under_review: 0, approved: 0, rejected: 0 });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedAppealId, setSelectedAppealId] = useState('');
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionState, setActionState] = useState(null);

  const tabs = [
    { label: 'Reports', to: '/admin/moderation', end: true },
    { label: 'Appeals', to: '/admin/moderation/appeals' }
  ];

  async function loadReports(nextFilters = reportFilters) {
    const data = await fetchAdminModerationReports(nextFilters);
    setReports(data?.items || []);
    setReportSummary(data?.summary || { total: 0, open: 0, under_review: 0, resolved: 0, dismissed: 0 });
    setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
  }

  async function loadAppeals(nextFilters = appealFilters) {
    const data = await fetchAdminModerationAppeals(nextFilters);
    setAppeals(data?.items || []);
    setAppealSummary(data?.summary || { total: 0, pending: 0, under_review: 0, approved: 0, rejected: 0 });
    setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
  }

  async function loadActiveView() {
    try {
      setLoading(true);
      if (activeView === 'appeals') {
        await loadAppeals(appealFilters);
      } else {
        await loadReports(reportFilters);
      }
    } catch (err) {
      toast.error(err.message || `Failed to load ${activeView}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        setLoading(true);
        if (activeView === 'appeals') {
          const data = await fetchAdminModerationAppeals({
            status: appealFilters.status,
            createdFrom: appealFilters.createdFrom,
            createdTo: appealFilters.createdTo,
            page: appealFilters.page,
            limit: appealFilters.limit
          });
          if (!active) return;
          setAppeals(data?.items || []);
          setAppealSummary(data?.summary || { total: 0, pending: 0, under_review: 0, approved: 0, rejected: 0 });
          setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
        } else {
          const data = await fetchAdminModerationReports({
            status: reportFilters.status,
            itemType: reportFilters.itemType,
            reason: reportFilters.reason,
            createdFrom: reportFilters.createdFrom,
            createdTo: reportFilters.createdTo,
            page: reportFilters.page,
            limit: reportFilters.limit
          });
          if (!active) return;
          setReports(data?.items || []);
          setReportSummary(data?.summary || { total: 0, open: 0, under_review: 0, resolved: 0, dismissed: 0 });
          setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
        }
      } catch (err) {
        if (active) {
          toast.error(err.message || `Failed to load ${activeView}`);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      active = false;
    };
  }, [
    activeView,
    reportFilters.page,
    reportFilters.status,
    reportFilters.itemType,
    reportFilters.reason,
    reportFilters.createdFrom,
    reportFilters.createdTo,
    reportFilters.limit,
    appealFilters.page,
    appealFilters.status,
    appealFilters.createdFrom,
    appealFilters.createdTo,
    appealFilters.limit
  ]);

  useEffect(() => {
    if (activeView !== 'reports') return undefined;
    const timeout = setTimeout(() => {
      loadActiveView();
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, reportFilters.search]);

  useEffect(() => {
    if (activeView !== 'appeals') return undefined;
    const timeout = setTimeout(() => {
      loadActiveView();
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, appealFilters.search]);

  async function openReport(reportId) {
    setSelectedReportId(reportId);
    setDetailsLoading(true);
    try {
      const data = await fetchAdminModerationReportDetails(reportId);
      setSelectedReport(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load report details');
    } finally {
      setDetailsLoading(false);
    }
  }

  async function openAppeal(appealId) {
    setSelectedAppealId(appealId);
    setDetailsLoading(true);
    try {
      const data = await fetchAdminModerationAppealDetails(appealId);
      setSelectedAppeal(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load appeal details');
    } finally {
      setDetailsLoading(false);
    }
  }

  async function refreshSelectedReport() {
    if (!selectedReportId) return;
    const data = await fetchAdminModerationReportDetails(selectedReportId);
    setSelectedReport(data);
  }

  async function refreshSelectedAppeal() {
    if (!selectedAppealId) return;
    const data = await fetchAdminModerationAppealDetails(selectedAppealId);
    setSelectedAppeal(data);
  }

  async function handleConfirmAction(reason) {
    try {
      if (actionState?.entity === 'report') {
        if (actionState.type === 'under_review') {
          await markAdminModerationReportUnderReview(actionState.id, { note: reason });
          toast.success('Report marked under review');
        } else if (actionState.type === 'resolve') {
          await resolveAdminModerationReport(actionState.id, { note: reason });
          toast.success('Report resolved');
        } else if (actionState.type === 'dismiss') {
          await dismissAdminModerationReport(actionState.id, { note: reason });
          toast.success('Report dismissed');
        } else if (actionState.type === 'note') {
          await addAdminModerationReportNote(actionState.id, { note: reason });
          toast.success('Admin note added');
        } else if (actionState.type === 'warn') {
          await warnAdminModerationReportUser(actionState.id, { note: reason });
          toast.success('User warned');
        } else if (actionState.type === 'hide') {
          await hideAdminModerationReportContent(actionState.id, { note: reason });
          toast.success('Content hidden');
        } else if (actionState.type === 'user_status') {
          await updateAdminModerationReportUserStatus(actionState.id, {
            status: actionState.value,
            reason
          });
          toast.success(`User ${actionState.value} successfully`);
        }

        setActionState(null);
        await loadReports();
        if (selectedReportId === actionState.id) {
          await refreshSelectedReport();
        }
      } else if (actionState?.entity === 'appeal') {
        if (actionState.type === 'approve') {
          await approveAdminModerationAppeal(actionState.id, { note: reason });
          toast.success('Appeal approved');
        } else if (actionState.type === 'reject') {
          await rejectAdminModerationAppeal(actionState.id, { note: reason });
          toast.success('Appeal rejected');
        } else if (actionState.type === 'note') {
          await addAdminModerationAppealNote(actionState.id, { note: reason });
          toast.success('Appeal note added');
        }

        setActionState(null);
        await loadAppeals();
        if (selectedAppealId === actionState.id) {
          await refreshSelectedAppeal();
        }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save moderation update');
    }
  }

  function renderSummaryCards() {
    if (activeView === 'appeals') {
      return (
        <div className="admin-stats-grid">
          <AdminStatCard label="Appeals" value={appealSummary.total} hint="Total appeal submissions loaded" tone="info" />
          <AdminStatCard label="Pending" value={appealSummary.pending} hint="Waiting for admin review" tone="warning" />
          <AdminStatCard label="Approved" value={appealSummary.approved} hint="Appeals that reactivated accounts" tone="success" />
          <AdminStatCard label="Rejected" value={appealSummary.rejected} hint="Appeals that remained denied" tone="danger" />
        </div>
      );
    }

    return (
      <div className="admin-stats-grid">
        <AdminStatCard label="Report Groups" value={reportSummary.total} hint="Grouped by reported item" tone="info" />
        <AdminStatCard label="Open" value={reportSummary.open} hint="Needs an initial moderation decision" tone="warning" />
        <AdminStatCard label="Under Review" value={reportSummary.under_review} hint="Actively being checked by admins" tone="info" />
        <AdminStatCard label="Resolved" value={reportSummary.resolved} hint="Addressed through moderation actions" tone="success" />
      </div>
    );
  }

  function renderReportsView() {
    if (loading) {
      return <AdminLoadingState label="Loading moderation reports..." />;
    }

    if (!reports.length) {
      return <AdminEmptyState title="No moderation reports found" description="When users report posts, comments, questions, or accounts, they will appear here." />;
    }

    return (
      <>
        <AdminTable
          columns={['Reported item', 'Type', 'Reported by', 'Target owner', 'Reason', 'Count', 'Status', 'Created', 'Actions']}
          minWidth={1380}
        >
          {reports.map((report) => (
            <tr key={report.id}>
              <td>
                <button type="button" className="admin-link-button" onClick={() => openReport(report.id)}>
                  {report.target?.preview || 'Untitled item'}
                </button>
              </td>
              <td><AdminBadge tone="neutral">{report.itemType}</AdminBadge></td>
              <td>
                <strong>{report.reportedBy?.name || 'Unknown reporter'}</strong>
                <div className="admin-table__muted">{report.reportedBy?.email || 'N/A'}</div>
              </td>
              <td>
                <strong>{report.target?.owner?.name || 'N/A'}</strong>
                <div className="admin-table__muted">{report.target?.owner?.email || 'No linked owner'}</div>
              </td>
              <td>{report.reason?.replace(/_/g, ' ') || 'other'}</td>
              <td>{report.reportCount}</td>
              <td><AdminBadge tone={toneForStatus(report.status)}>{report.status}</AdminBadge></td>
              <td>{formatDate(report.createdAt)}</td>
              <td>
                <div className="admin-table__actions">
                  <AdminActionButton variant="ghost" onClick={() => openReport(report.id)}>
                    View
                  </AdminActionButton>
                  <AdminActionButton tone="info" variant="ghost" onClick={() => setActionState({
                    entity: 'report',
                    type: 'under_review',
                    id: report.id,
                    title: 'Mark this report under review?',
                    description: 'Use this when the moderation team has started investigating but is not ready to resolve the case.'
                  })}>
                    Review
                  </AdminActionButton>
                  <AdminActionButton tone="success" variant="ghost" onClick={() => setActionState({
                    entity: 'report',
                    type: 'resolve',
                    id: report.id,
                    title: 'Resolve this report?',
                    description: 'This marks the grouped report as handled.'
                  })}>
                    Resolve
                  </AdminActionButton>
                  <AdminActionButton tone="default" variant="ghost" onClick={() => setActionState({
                    entity: 'report',
                    type: 'dismiss',
                    id: report.id,
                    title: 'Dismiss this report?',
                    description: 'Use this when the report is invalid or no moderation action is required.'
                  })}>
                    Dismiss
                  </AdminActionButton>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>

        <AdminPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onChange={(page) => setReportFilters((prev) => ({ ...prev, page }))}
        />
      </>
    );
  }

  function renderAppealsView() {
    if (loading) {
      return <AdminLoadingState label="Loading moderation appeals..." />;
    }

    if (!appeals.length) {
      return <AdminEmptyState title="No appeals submitted yet" description="There is no existing user appeal intake in the app right now, so this queue will stay empty until appeal records are created." />;
    }

    return (
      <>
        <AdminTable
          columns={['User', 'Email', 'Current status', 'Appeal reason', 'Submitted', 'Status', 'Actions']}
          minWidth={1260}
        >
          {appeals.map((appeal) => (
            <tr key={appeal.id}>
              <td>
                <button type="button" className="admin-link-button" onClick={() => openAppeal(appeal.id)}>
                  {appeal.user?.name || 'Unknown user'}
                </button>
              </td>
              <td>{appeal.user?.email || 'N/A'}</td>
              <td><AdminBadge tone={toneForStatus(appeal.user?.accountStatus || 'neutral')}>{appeal.user?.accountStatus || 'unknown'}</AdminBadge></td>
              <td>{appeal.reason}</td>
              <td>{formatDate(appeal.submittedAt)}</td>
              <td><AdminBadge tone={toneForStatus(appeal.status)}>{appeal.status}</AdminBadge></td>
              <td>
                <div className="admin-table__actions">
                  <AdminActionButton variant="ghost" onClick={() => openAppeal(appeal.id)}>
                    View
                  </AdminActionButton>
                  <AdminActionButton tone="success" variant="ghost" onClick={() => setActionState({
                    entity: 'appeal',
                    type: 'approve',
                    id: appeal.id,
                    title: 'Approve this appeal?',
                    description: 'This will reactivate the account through the existing admin user-status workflow.',
                    requireReason: true
                  })}>
                    Approve
                  </AdminActionButton>
                  <AdminActionButton tone="danger" variant="ghost" onClick={() => setActionState({
                    entity: 'appeal',
                    type: 'reject',
                    id: appeal.id,
                    title: 'Reject this appeal?',
                    description: 'This keeps the current restriction in place.',
                    requireReason: true
                  })}>
                    Reject
                  </AdminActionButton>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>

        <AdminPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onChange={(page) => setAppealFilters((prev) => ({ ...prev, page }))}
        />
      </>
    );
  }

  if (location.pathname === '/admin/reports') {
    return <Navigate to="/admin/moderation" replace />;
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        title="Moderation"
        description="Review community and question reports, record moderation notes, and handle account appeals without changing the existing learner-facing workflows."
        badge={{ label: activeView === 'appeals' ? `${appealSummary.total} appeals` : `${reportSummary.total} report groups`, tone: 'info' }}
        tabs={tabs}
      />

      {renderSummaryCards()}

      <section className="admin-panel">
        <div className="admin-toolbar">
          <label className="admin-field admin-field--search">
            <span>Search</span>
            <input
              value={activeView === 'appeals' ? appealFilters.search : reportFilters.search}
              onChange={(event) => {
                const value = event.target.value;
                if (activeView === 'appeals') {
                  setAppealFilters((prev) => ({ ...prev, search: value, page: 1 }));
                } else {
                  setReportFilters((prev) => ({ ...prev, search: value, page: 1 }));
                }
              }}
              placeholder={activeView === 'appeals' ? 'User name, email, or appeal reason' : 'Reporter, target owner, or content preview'}
            />
          </label>

          <label className="admin-field">
            <span>Status</span>
            <select
              value={activeView === 'appeals' ? appealFilters.status : reportFilters.status}
              onChange={(event) => {
                const value = event.target.value;
                if (activeView === 'appeals') {
                  setAppealFilters((prev) => ({ ...prev, status: value, page: 1 }));
                } else {
                  setReportFilters((prev) => ({ ...prev, status: value, page: 1 }));
                }
              }}
            >
              <option value="">All statuses</option>
              {(activeView === 'appeals' ? APPEAL_STATUS_OPTIONS : REPORT_STATUS_OPTIONS).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          {activeView === 'reports' ? (
            <>
              <label className="admin-field">
                <span>Item type</span>
                <select
                  value={reportFilters.itemType}
                  onChange={(event) => setReportFilters((prev) => ({ ...prev, itemType: event.target.value, page: 1 }))}
                >
                  <option value="">All item types</option>
                  {REPORT_TYPE_OPTIONS.map((itemType) => (
                    <option key={itemType} value={itemType}>{itemType}</option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Reason</span>
                <select
                  value={reportFilters.reason}
                  onChange={(event) => setReportFilters((prev) => ({ ...prev, reason: event.target.value, page: 1 }))}
                >
                  <option value="">All reasons</option>
                  {REPORT_REASON_OPTIONS.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className="admin-field">
            <span>Created from</span>
            <input
              type="date"
              value={activeView === 'appeals' ? appealFilters.createdFrom : reportFilters.createdFrom}
              onChange={(event) => {
                const value = event.target.value;
                if (activeView === 'appeals') {
                  setAppealFilters((prev) => ({ ...prev, createdFrom: value, page: 1 }));
                } else {
                  setReportFilters((prev) => ({ ...prev, createdFrom: value, page: 1 }));
                }
              }}
            />
          </label>

          <label className="admin-field">
            <span>Created to</span>
            <input
              type="date"
              value={activeView === 'appeals' ? appealFilters.createdTo : reportFilters.createdTo}
              onChange={(event) => {
                const value = event.target.value;
                if (activeView === 'appeals') {
                  setAppealFilters((prev) => ({ ...prev, createdTo: value, page: 1 }));
                } else {
                  setReportFilters((prev) => ({ ...prev, createdTo: value, page: 1 }));
                }
              }}
            />
          </label>
        </div>

        {activeView === 'appeals' ? renderAppealsView() : renderReportsView()}
      </section>

      <AdminModerationReportDrawer
        report={selectedReport}
        open={Boolean(selectedReportId)}
        loading={detailsLoading && Boolean(selectedReportId)}
        onClose={() => {
          setSelectedReportId('');
          setSelectedReport(null);
        }}
        onMarkUnderReview={() => setActionState({
          entity: 'report',
          type: 'under_review',
          id: selectedReportId,
          title: 'Mark this report under review?',
          description: 'This keeps the case active while the moderation team investigates it.'
        })}
        onResolve={() => setActionState({
          entity: 'report',
          type: 'resolve',
          id: selectedReportId,
          title: 'Resolve this report?',
          description: 'Use this after the issue has been addressed.'
        })}
        onDismiss={() => setActionState({
          entity: 'report',
          type: 'dismiss',
          id: selectedReportId,
          title: 'Dismiss this report?',
          description: 'Use this when the report is invalid or not actionable.'
        })}
        onAddNote={() => setActionState({
          entity: 'report',
          type: 'note',
          id: selectedReportId,
          title: 'Add an admin note?',
          description: 'This note stays inside the admin moderation workflow.',
          requireReason: true
        })}
        onWarnUser={() => setActionState({
          entity: 'report',
          type: 'warn',
          id: selectedReportId,
          title: 'Warn the target user?',
          description: 'This sends a moderation warning and resolves the report.',
          requireReason: true
        })}
        onHideContent={() => setActionState({
          entity: 'report',
          type: 'hide',
          id: selectedReportId,
          title: 'Hide the reported content?',
          description: 'This is a confirmation-gated moderation action for reported posts or comments.',
          requireReason: true
        })}
        onSuspendUser={() => setActionState({
          entity: 'report',
          type: 'user_status',
          value: 'suspended',
          id: selectedReportId,
          title: 'Suspend the target user?',
          description: 'This reuses the existing Phase 2 account-status logic.',
          requireReason: true
        })}
        onBanUser={() => setActionState({
          entity: 'report',
          type: 'user_status',
          value: 'banned',
          id: selectedReportId,
          title: 'Ban the target user?',
          description: 'This reuses the existing Phase 2 account-status logic and requires a reason.',
          requireReason: true
        })}
      />

      <AdminModerationAppealDrawer
        appeal={selectedAppeal}
        open={Boolean(selectedAppealId)}
        loading={detailsLoading && Boolean(selectedAppealId)}
        onClose={() => {
          setSelectedAppealId('');
          setSelectedAppeal(null);
        }}
        onApprove={() => setActionState({
          entity: 'appeal',
          type: 'approve',
          id: selectedAppealId,
          title: 'Approve this appeal?',
          description: 'This will reactivate the account through the existing admin user-status logic.',
          requireReason: true
        })}
        onReject={() => setActionState({
          entity: 'appeal',
          type: 'reject',
          id: selectedAppealId,
          title: 'Reject this appeal?',
          description: 'This keeps the existing restriction in place.',
          requireReason: true
        })}
        onAddNote={() => setActionState({
          entity: 'appeal',
          type: 'note',
          id: selectedAppealId,
          title: 'Add an appeal note?',
          description: 'This note stays inside the admin appeal workflow.',
          requireReason: true
        })}
      />

      <AdminConfirmModal
        open={Boolean(actionState)}
        title={actionState?.title}
        description={actionState?.description}
        requireReason={actionState?.requireReason}
        reasonLabel={actionState?.entity === 'appeal' ? 'Admin note' : actionState?.type === 'note' ? 'Admin note' : 'Reason'}
        confirmLabel="Save update"
        onClose={() => setActionState(null)}
        onConfirm={handleConfirmAction}
      />
    </section>
  );
}
