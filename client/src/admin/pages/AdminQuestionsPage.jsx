import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminActionButton from '../components/AdminActionButton';
import AdminBadge from '../components/AdminBadge';
import AdminConfirmModal from '../components/AdminConfirmModal';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPagination from '../components/AdminPagination';
import AdminQuestionDetailsDrawer from '../components/AdminQuestionDetailsDrawer';
import AdminQuestionEditModal from '../components/AdminQuestionEditModal';
import AdminTable from '../components/AdminTable';
import {
  approveAdminQuestion,
  editAdminQuestion,
  fetchAdminQuestionDetails,
  fetchAdminQuestionQuality,
  fetchAdminQuestionReports,
  fetchAdminQuestions,
  rejectAdminQuestion,
  updateAdminQuestionReportStatus
} from '../services/adminApi';

const QUESTION_STATUS_OPTIONS = ['pending', 'approved', 'rejected'];
const QUESTION_TYPE_OPTIONS = ['mcq', 'written', 'cq'];
const DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard'];
const SUBJECT_OPTIONS = ['Physics', 'Chemistry', 'Higher Math', 'Biology', 'Bangla', 'English', 'ICT', 'Statistics', 'Accounting', 'Finance', 'Economics', 'Management'];
const REPORT_STATUS_OPTIONS = ['open', 'under_review', 'resolved', 'dismissed'];

function formatDate(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
}

function toneForStatus(status) {
  if (status === 'approved' || status === 'resolved') return 'success';
  if (status === 'rejected' || status === 'dismissed') return 'danger';
  if (status === 'pending' || status === 'open') return 'warning';
  if (status === 'under_review') return 'info';
  return 'neutral';
}

function getViewFromPath(pathname) {
  if (pathname.endsWith('/pending')) return 'pending';
  if (pathname.endsWith('/reports')) return 'reports';
  if (pathname.endsWith('/quality')) return 'quality';
  if (pathname.endsWith('/import-export')) return 'import-export';
  return 'all';
}

export default function AdminQuestionsPage() {
  const location = useLocation();
  const activeView = useMemo(() => getViewFromPath(location.pathname), [location.pathname]);
  const [filters, setFilters] = useState({
    search: '',
    status: activeView === 'pending' ? 'pending' : '',
    subject: '',
    type: '',
    difficulty: '',
    page: 1,
    limit: 10
  });
  const [questions, setQuestions] = useState([]);
  const [reports, setReports] = useState([]);
  const [quality, setQuality] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionState, setActionState] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(false);

  const tabs = [
    { label: 'All Questions', to: '/admin/questions', end: true },
    { label: 'Pending Approval', to: '/admin/questions/pending' },
    { label: 'Wrong Question Reports', to: '/admin/questions/reports' },
    { label: 'Quality Dashboard', to: '/admin/questions/quality' },
    { label: 'Import / Export', to: '/admin/questions/import-export' }
  ];

  async function loadData(nextFilters = filters) {
    try {
      setLoading(true);
      if (activeView === 'reports') {
        const data = await fetchAdminQuestionReports({
          search: nextFilters.search,
          status: nextFilters.status,
          page: nextFilters.page,
          limit: nextFilters.limit
        });
        setReports(data?.items || []);
        setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
      } else if (activeView === 'quality') {
        const data = await fetchAdminQuestionQuality();
        setQuality(data);
      } else {
        const status = activeView === 'pending' ? 'pending' : nextFilters.status;
        const data = await fetchAdminQuestions({
          ...nextFilters,
          status
        });
        setQuestions(data?.items || []);
        setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load question management data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      status: activeView === 'pending' ? 'pending' : '',
      page: 1
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  useEffect(() => {
    if (activeView === 'quality' || activeView === 'import-export') {
      loadData(filters);
      return;
    }
    loadData(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, filters.page, filters.status, filters.subject, filters.type, filters.difficulty]);

  useEffect(() => {
    if (activeView === 'quality' || activeView === 'import-export') return undefined;
    const timeout = setTimeout(() => {
      loadData({ ...filters, page: 1 });
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  async function openQuestion(questionId) {
    setSelectedQuestionId(questionId);
    setDetailsLoading(true);
    try {
      const data = await fetchAdminQuestionDetails(questionId);
      setSelectedQuestion(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load question details');
    } finally {
      setDetailsLoading(false);
    }
  }

  async function refreshQuestion(questionId) {
    const refreshed = await fetchAdminQuestionDetails(questionId);
    setSelectedQuestion(refreshed);
  }

  async function handleActionConfirm(reason) {
    try {
      if (actionState.type === 'approve') {
        await approveAdminQuestion(actionState.questionId, { reason });
        toast.success('Question approved');
      } else if (actionState.type === 'reject') {
        await rejectAdminQuestion(actionState.questionId, { reason });
        toast.success('Question rejected');
      } else if (actionState.type === 'report') {
        await updateAdminQuestionReportStatus(actionState.questionId, {
          status: actionState.value,
          note: reason
        });
        toast.success('Question reports updated');
      }

      const currentId = actionState.questionId;
      setActionState(null);
      await loadData();
      if (selectedQuestionId === currentId) {
        await refreshQuestion(currentId);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update question workflow');
    }
  }

  async function handleEditSave(payload) {
    try {
      const updated = await editAdminQuestion(selectedQuestionId, payload);
      setSelectedQuestion(updated);
      setEditingQuestion(false);
      toast.success('Question updated');
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update question');
    }
  }

  function renderQuestionTable() {
    if (loading) {
      return <div className="admin-page-loader"><div className="admin-spinner" /><p>Loading questions...</p></div>;
    }

    if (!questions.length) {
      return (
        <AdminEmptyState
          title="No questions found"
          description="Try changing the current filters or switch to the pending approval tab."
        />
      );
    }

    return (
      <>
        <AdminTable
          columns={['Question', 'Subject', 'Paper / Chapter / Topic', 'Difficulty', 'Submitted by', 'Status', 'Created', 'Actions']}
          minWidth={1280}
        >
          {questions.map((question) => (
            <tr key={question.id}>
              <td>
                <button type="button" className="admin-link-button" onClick={() => openQuestion(question.id)}>
                  {question.preview}
                </button>
              </td>
              <td>{question.subject}</td>
              <td>{[question.paper, question.chapter, question.topic].filter(Boolean).join(' / ')}</td>
              <td><AdminBadge tone="neutral">{question.difficulty || 'medium'}</AdminBadge></td>
              <td>
                <strong>{question.submittedBy?.name || 'Unknown teacher'}</strong>
                <div className="admin-table__muted">{question.submittedBy?.email || 'N/A'}</div>
              </td>
              <td><AdminBadge tone={toneForStatus(question.status)}>{question.status}</AdminBadge></td>
              <td>{formatDate(question.createdAt)}</td>
              <td>
                <div className="admin-table__actions">
                  <AdminActionButton variant="ghost" onClick={() => openQuestion(question.id)}>View</AdminActionButton>
                  {question.status !== 'approved' ? (
                    <AdminActionButton onClick={() => setActionState({ type: 'approve', questionId: question.id, title: 'Approve this question?', description: 'This will make the question available in approved question bank flows.' })}>
                      Approve
                    </AdminActionButton>
                  ) : null}
                  {question.status !== 'rejected' ? (
                    <AdminActionButton tone="danger" variant="ghost" onClick={() => setActionState({ type: 'reject', questionId: question.id, title: 'Reject this question?', description: 'This will keep the question out of approved student-facing flows.', requireReason: true })}>
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
    );
  }

  function renderReportsTable() {
    if (loading) {
      return <div className="admin-page-loader"><div className="admin-spinner" /><p>Loading question reports...</p></div>;
    }

    if (!reports.length) {
      return <AdminEmptyState title="No wrong-question reports" description="Reports will appear here once users flag question issues." />;
    }

    return (
      <>
        <AdminTable columns={['Question', 'Reason', 'Report count', 'Status', 'Created', 'Actions']} minWidth={1120}>
          {reports.map((report) => (
            <tr key={report.questionId}>
              <td>
                <button type="button" className="admin-link-button" onClick={() => openQuestion(report.questionId)}>
                  {report.question.preview}
                </button>
              </td>
              <td>{report.reason.replace(/_/g, ' ')}</td>
              <td>{report.reportCount}</td>
              <td><AdminBadge tone={toneForStatus(report.status)}>{report.status}</AdminBadge></td>
              <td>{formatDate(report.createdAt)}</td>
              <td>
                <div className="admin-table__actions">
                  <AdminActionButton variant="ghost" onClick={() => openQuestion(report.questionId)}>View question</AdminActionButton>
                  <AdminActionButton tone="info" variant="ghost" onClick={() => setActionState({ type: 'report', questionId: report.questionId, value: 'under_review', title: 'Mark these reports under review?', description: 'This keeps the issue active while the admin validates the question.' })}>
                    Mark valid
                  </AdminActionButton>
                  <AdminActionButton tone="success" variant="ghost" onClick={() => setActionState({ type: 'report', questionId: report.questionId, value: 'resolved', title: 'Resolve these reports?', description: 'Use this after the question is confirmed fixed or the issue is addressed.' })}>
                    Resolve
                  </AdminActionButton>
                  <AdminActionButton tone="danger" variant="ghost" onClick={() => setActionState({ type: 'report', questionId: report.questionId, value: 'dismissed', title: 'Dismiss these reports?', description: 'Use this when the report is invalid or not actionable.' })}>
                    Dismiss
                  </AdminActionButton>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
        <AdminPagination page={pagination.page} totalPages={pagination.totalPages} onChange={(page) => setFilters((prev) => ({ ...prev, page }))} />
      </>
    );
  }

  function renderQualityDashboard() {
    if (loading) {
      return <div className="admin-page-loader"><div className="admin-spinner" /><p>Loading quality dashboard...</p></div>;
    }

    return (
      <div className="admin-panels-grid admin-panels-grid--equal">
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Most reported questions</h3>
              <p className="admin-panel__subtext">Questions attracting the highest number of issue reports.</p>
            </div>
          </div>
          {(quality?.mostReportedQuestions || []).length ? (
            <div className="admin-history-list">
              {quality.mostReportedQuestions.map((item) => (
                <div className="admin-history-item" key={item.questionId}>
                  <div>
                    <strong>{item.preview}</strong>
                    <span>{item.subject} · {item.chapter}</span>
                  </div>
                  <AdminBadge tone="warning">{item.reportCount} reports</AdminBadge>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState compact title="No reported questions yet" description="The quality dashboard will surface reported questions here." />
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Low-performing questions</h3>
              <p className="admin-panel__subtext">Based on practice attempt data where enough answers exist.</p>
            </div>
          </div>
          {(quality?.lowPerformingQuestions || []).length ? (
            <div className="admin-history-list">
              {quality.lowPerformingQuestions.map((item) => (
                <div className="admin-history-item" key={item.questionId}>
                  <div>
                    <strong>{item.preview}</strong>
                    <span>{item.subject} · {item.chapter} · {item.attempts} attempts</span>
                  </div>
                  <AdminBadge tone="danger">{item.correctRate}% correct</AdminBadge>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState compact title="No low-performing questions yet" description="Not enough attempt data exists to score question quality here." />
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Recently rejected questions</h3>
              <p className="admin-panel__subtext">Latest questions rejected by admins with feedback retained.</p>
            </div>
          </div>
          {(quality?.recentlyRejectedQuestions || []).length ? (
            <div className="admin-history-list">
              {quality.recentlyRejectedQuestions.map((item) => (
                <div className="admin-history-item" key={item.questionId}>
                  <div>
                    <strong>{item.preview}</strong>
                    <span>{item.reason || 'No reason recorded'}</span>
                  </div>
                  <time>{formatDate(item.reviewedAt)}</time>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState compact title="No rejected questions yet" description="Rejected question feedback will appear here." />
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Future quality datasets</h3>
              <p className="admin-panel__subtext">Placeholders for datasets that need more modeling or import support.</p>
            </div>
          </div>
          <ul className="admin-list">
            <li>
              <div>
                <strong>Duplicate question detection</strong>
                <span>No duplicate-detection model exists yet, so this remains a placeholder.</span>
              </div>
              <AdminBadge tone="neutral" size="sm">Placeholder</AdminBadge>
            </li>
            <li>
              <div>
                <strong>Unused approved questions</strong>
                <span>{quality?.unusedQuestions?.count ?? 0} approved questions have not appeared in tracked practice attempts.</span>
              </div>
              <AdminBadge tone="info" size="sm">{quality?.unusedQuestions?.count ?? 0}</AdminBadge>
            </li>
          </ul>
        </section>
      </div>
    );
  }

  function renderImportExportPlaceholder() {
    return (
      <section className="admin-panel">
        <AdminEmptyState
          title="Bulk import / export is planned"
          description="The admin console is ready for future CSV, Excel, and JSON workflows, but risky partial import logic was intentionally not shipped in this phase."
        />
        <ul className="admin-list" style={{ marginTop: 16 }}>
          <li>
            <div>
              <strong>Future import formats</strong>
              <span>CSV, Excel, and JSON bulk upload workflows for question batches.</span>
            </div>
            <AdminBadge tone="planned" size="sm">Planned</AdminBadge>
          </li>
          <li>
            <div>
              <strong>Future export formats</strong>
              <span>Admin-reviewed question exports filtered by subject, status, and source tags.</span>
            </div>
            <AdminBadge tone="planned" size="sm">Planned</AdminBadge>
          </li>
        </ul>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        title="Question Bank Management"
        description="Review teacher-submitted questions, manage wrong-question reports, and monitor question quality without changing the learner-facing question bank design."
        badge={{ label: activeView === 'reports' ? `${pagination.total} report groups` : `${pagination.total || 0} records`, tone: 'info' }}
        tabs={tabs}
      />

      {activeView !== 'quality' && activeView !== 'import-export' ? (
        <section className="admin-panel">
          <div className="admin-toolbar">
            <label className="admin-field admin-field--search">
              <span>Search</span>
              <input
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
                placeholder={activeView === 'reports' ? 'Question text, subject, or teacher' : 'Question text, subject, chapter, or topic'}
              />
            </label>

            <label className="admin-field">
              <span>{activeView === 'reports' ? 'Report status' : 'Approval status'}</span>
              <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))}>
                <option value="">All statuses</option>
                {(activeView === 'reports' ? REPORT_STATUS_OPTIONS : QUESTION_STATUS_OPTIONS).map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>

            {activeView !== 'reports' ? (
              <>
                <label className="admin-field">
                  <span>Subject</span>
                  <select value={filters.subject} onChange={(event) => setFilters((prev) => ({ ...prev, subject: event.target.value, page: 1 }))}>
                    <option value="">All subjects</option>
                    {SUBJECT_OPTIONS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                  </select>
                </label>

                <label className="admin-field">
                  <span>Type</span>
                  <select value={filters.type} onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value, page: 1 }))}>
                    <option value="">All types</option>
                    {QUESTION_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>

                <label className="admin-field">
                  <span>Difficulty</span>
                  <select value={filters.difficulty} onChange={(event) => setFilters((prev) => ({ ...prev, difficulty: event.target.value, page: 1 }))}>
                    <option value="">All levels</option>
                    {DIFFICULTY_OPTIONS.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
                  </select>
                </label>
              </>
            ) : null}
          </div>

          {activeView === 'reports' ? renderReportsTable() : renderQuestionTable()}
        </section>
      ) : null}

      {activeView === 'quality' ? renderQualityDashboard() : null}
      {activeView === 'import-export' ? renderImportExportPlaceholder() : null}

      <AdminQuestionDetailsDrawer
        question={selectedQuestion}
        open={Boolean(selectedQuestionId)}
        loading={detailsLoading}
        onClose={() => {
          setSelectedQuestionId('');
          setSelectedQuestion(null);
        }}
        onApprove={() => setActionState({ type: 'approve', questionId: selectedQuestionId, title: 'Approve this question?', description: 'This will make the question available in approved student-facing flows.' })}
        onReject={() => setActionState({ type: 'reject', questionId: selectedQuestionId, title: 'Reject this question?', description: 'This will keep the question out of approved student-facing flows.', requireReason: true })}
        onEdit={() => setEditingQuestion(true)}
      />

      <AdminQuestionEditModal
        open={editingQuestion}
        question={selectedQuestion}
        onClose={() => setEditingQuestion(false)}
        onSave={handleEditSave}
      />

      <AdminConfirmModal
        open={Boolean(actionState)}
        title={actionState?.title}
        description={actionState?.description}
        requireReason={actionState?.requireReason}
        reasonLabel={actionState?.type === 'report' ? 'Admin note' : 'Admin reason'}
        confirmLabel="Save update"
        onClose={() => setActionState(null)}
        onConfirm={handleActionConfirm}
      />
    </section>
  );
}
