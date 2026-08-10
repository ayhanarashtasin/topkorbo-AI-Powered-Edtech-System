import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminActionButton from '../components/AdminActionButton';
import AdminBadge from '../components/AdminBadge';
import AdminConfirmModal from '../components/AdminConfirmModal';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminFeedbackDrawer from '../components/AdminFeedbackDrawer';
import AdminLoadingState from '../components/AdminLoadingState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPagination from '../components/AdminPagination';
import AdminStatCard from '../components/AdminStatCard';
import AdminSupportTicketDrawer from '../components/AdminSupportTicketDrawer';
import AdminTable from '../components/AdminTable';
import {
  addAdminFeedbackNote,
  addAdminSupportTicketNote,
  fetchAdminFeedbackDetails,
  fetchAdminFeedbackEntries,
  fetchAdminSupportTicketDetails,
  fetchAdminSupportTickets,
  replyAdminSupportTicket,
  updateAdminFeedbackStatus,
  updateAdminSupportTicketPriority,
  updateAdminSupportTicketStatus,
  deleteAdminSupportTicket
} from '../services/adminApi';

const TICKET_STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];
const TICKET_PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'];
const TICKET_CATEGORY_OPTIONS = ['account', 'technical', 'billing', 'content', 'contest', 'ielts', 'general'];
const FEEDBACK_STATUS_OPTIONS = ['new', 'reviewed', 'dismissed', 'resolved'];
const FEEDBACK_TYPE_OPTIONS = ['question', 'book', 'contest', 'ielts_set', 'platform'];

function formatDate(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function toneForStatus(status) {
  if (status === 'resolved' || status === 'reviewed') return 'success';
  if (status === 'closed' || status === 'dismissed') return 'neutral';
  if (status === 'in_progress') return 'info';
  if (status === 'open' || status === 'new') return 'warning';
  return 'neutral';
}

function toneForPriority(priority) {
  if (priority === 'urgent') return 'danger';
  if (priority === 'high') return 'warning';
  if (priority === 'normal') return 'info';
  return 'neutral';
}

function getViewFromPath(pathname) {
  if (pathname.endsWith('/feedback')) return 'feedback';
  return 'tickets';
}

export default function AdminSupportPage() {
  const location = useLocation();
  const activeView = useMemo(() => getViewFromPath(location.pathname), [location.pathname]);
  const [ticketFilters, setTicketFilters] = useState({
    search: '',
    status: '',
    priority: '',
    category: '',
    createdFrom: '',
    createdTo: '',
    page: 1,
    limit: 10
  });
  const [feedbackFilters, setFeedbackFilters] = useState({
    search: '',
    status: '',
    itemType: '',
    createdFrom: '',
    createdTo: '',
    page: 1,
    limit: 10
  });
  const [tickets, setTickets] = useState([]);
  const [feedbackEntries, setFeedbackEntries] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionState, setActionState] = useState(null);

  const tabs = [
    { label: 'Tickets', to: '/admin/support', end: true },
    { label: 'Feedback', to: '/admin/support/feedback' }
  ];

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        setLoading(true);
        if (activeView === 'feedback') {
          const data = await fetchAdminFeedbackEntries({
            search: feedbackFilters.search,
            status: feedbackFilters.status,
            itemType: feedbackFilters.itemType,
            createdFrom: feedbackFilters.createdFrom,
            createdTo: feedbackFilters.createdTo,
            page: feedbackFilters.page,
            limit: feedbackFilters.limit
          });
          if (!active) return;
          setFeedbackEntries(data?.items || []);
          setSummary(data?.summary || {});
          setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
        } else {
          const data = await fetchAdminSupportTickets({
            search: ticketFilters.search,
            status: ticketFilters.status,
            priority: ticketFilters.priority,
            category: ticketFilters.category,
            createdFrom: ticketFilters.createdFrom,
            createdTo: ticketFilters.createdTo,
            page: ticketFilters.page,
            limit: ticketFilters.limit
          });
          if (!active) return;
          setTickets(data?.items || []);
          setSummary(data?.summary || {});
          setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
        }
      } catch (err) {
        if (active) {
          toast.error(err.message || 'Failed to load support admin data');
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
    ticketFilters.page,
    ticketFilters.search,
    ticketFilters.status,
    ticketFilters.priority,
    ticketFilters.category,
    ticketFilters.createdFrom,
    ticketFilters.createdTo,
    ticketFilters.limit,
    feedbackFilters.page,
    feedbackFilters.search,
    feedbackFilters.status,
    feedbackFilters.itemType,
    feedbackFilters.createdFrom,
    feedbackFilters.createdTo,
    feedbackFilters.limit
  ]);

  async function openTicket(ticketId) {
    setSelectedTicketId(ticketId);
    setDetailsLoading(true);
    try {
      const data = await fetchAdminSupportTicketDetails(ticketId);
      setSelectedTicket(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load support ticket details');
    } finally {
      setDetailsLoading(false);
    }
  }

  async function openFeedback(feedbackId) {
    setSelectedFeedbackId(feedbackId);
    setDetailsLoading(true);
    try {
      const data = await fetchAdminFeedbackDetails(feedbackId);
      setSelectedFeedback(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load feedback details');
    } finally {
      setDetailsLoading(false);
    }
  }

  async function reloadActiveView() {
    if (activeView === 'feedback') {
      const data = await fetchAdminFeedbackEntries({
        search: feedbackFilters.search,
        status: feedbackFilters.status,
        itemType: feedbackFilters.itemType,
        createdFrom: feedbackFilters.createdFrom,
        createdTo: feedbackFilters.createdTo,
        page: feedbackFilters.page,
        limit: feedbackFilters.limit
      });
      setFeedbackEntries(data?.items || []);
      setSummary(data?.summary || {});
      setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } else {
      const data = await fetchAdminSupportTickets({
        search: ticketFilters.search,
        status: ticketFilters.status,
        priority: ticketFilters.priority,
        category: ticketFilters.category,
        createdFrom: ticketFilters.createdFrom,
        createdTo: ticketFilters.createdTo,
        page: ticketFilters.page,
        limit: ticketFilters.limit
      });
      setTickets(data?.items || []);
      setSummary(data?.summary || {});
      setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
    }
  }

  async function handleConfirmAction(reason) {
    try {
      if (actionState?.entity === 'ticket') {
        if (actionState.type === 'status') {
          await updateAdminSupportTicketStatus(actionState.id, { status: actionState.value, note: reason });
          toast.success('Support ticket status updated');
        } else if (actionState.type === 'priority') {
          await updateAdminSupportTicketPriority(actionState.id, { priority: actionState.value, note: reason });
          toast.success('Support ticket priority updated');
        } else if (actionState.type === 'reply') {
          await replyAdminSupportTicket(actionState.id, { message: reason });
          toast.success('Support ticket reply sent');
        } else if (actionState.type === 'note') {
          await addAdminSupportTicketNote(actionState.id, { note: reason });
          toast.success('Support ticket note added');
        } else if (actionState.type === 'delete') {
          await deleteAdminSupportTicket(actionState.id);
          toast.success('Support ticket deleted');
        }

        await reloadActiveView();
        if (selectedTicketId === actionState.id && actionState.type !== 'delete') {
          const refreshed = await fetchAdminSupportTicketDetails(actionState.id);
          setSelectedTicket(refreshed);
        } else if (actionState.type === 'delete' && selectedTicketId === actionState.id) {
          setSelectedTicketId('');
          setSelectedTicket(null);
        }
      } else if (actionState?.entity === 'feedback') {
        if (actionState.type === 'status') {
          await updateAdminFeedbackStatus(actionState.id, { status: actionState.value, note: reason });
          toast.success('Feedback status updated');
        } else if (actionState.type === 'note') {
          await addAdminFeedbackNote(actionState.id, { note: reason });
          toast.success('Feedback note added');
        }

        await reloadActiveView();
        if (selectedFeedbackId === actionState.id) {
          const refreshed = await fetchAdminFeedbackDetails(actionState.id);
          setSelectedFeedback(refreshed);
        }
      }

      setActionState(null);
    } catch (err) {
      toast.error(err.message || 'Failed to save support update');
    }
  }

  function renderSummaryCards() {
    if (activeView === 'feedback') {
      return (
        <div className="admin-stats-grid">
          <AdminStatCard label="Feedback" value={summary.total || 0} hint="Stored feedback records" tone="info" />
          <AdminStatCard label="New" value={summary.new || 0} hint="Not yet reviewed" tone="warning" />
          <AdminStatCard label="Reviewed" value={summary.reviewed || 0} hint="Already reviewed by admins" tone="success" />
          <AdminStatCard label="Dismissed" value={summary.dismissed || 0} hint="Closed without follow-up" tone="neutral" />
        </div>
      );
    }

    return (
      <div className="admin-stats-grid">
        <AdminStatCard label="Tickets" value={summary.total || 0} hint="Stored support tickets" tone="info" />
        <AdminStatCard label="Open" value={summary.open || 0} hint="Waiting for the first response" tone="warning" />
        <AdminStatCard label="In progress" value={summary.in_progress || 0} hint="Actively being handled" tone="info" />
        <AdminStatCard label="Resolved" value={summary.resolved || 0} hint="Support issues that were resolved" tone="success" />
      </div>
    );
  }

  function renderTickets() {
    if (loading) return <AdminLoadingState label="Loading support tickets..." />;
    if (!tickets.length) {
      return <AdminEmptyState title="No support tickets found" description="No contact or support intake exists in the app yet, so this queue stays empty until real ticket records are created." />;
    }

    return (
      <>
        <AdminTable columns={['Title', 'User', 'Role', 'Category', 'Priority', 'Status', 'Created', 'Updated', 'Actions']} minWidth={1340}>
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td>
                <button type="button" className="admin-link-button" onClick={() => openTicket(ticket.id)}>
                  {ticket.title}
                </button>
              </td>
              <td>
                <strong>{ticket.user?.name || 'Anonymous user'}</strong>
                <div className="admin-table__muted">{ticket.user?.email || 'No email'}</div>
              </td>
              <td>{ticket.user?.role || 'unknown'}</td>
              <td>{ticket.category}</td>
              <td><AdminBadge tone={toneForPriority(ticket.priority)}>{ticket.priority}</AdminBadge></td>
              <td><AdminBadge tone={toneForStatus(ticket.status)}>{ticket.status}</AdminBadge></td>
              <td>{formatDate(ticket.createdAt)}</td>
              <td>{formatDate(ticket.updatedAt)}</td>
              <td>
                <div className="admin-table__actions">
                  <AdminActionButton variant="ghost" onClick={() => openTicket(ticket.id)}>View</AdminActionButton>
                  <select
                    value=""
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) return;
                      setActionState({
                        entity: 'ticket',
                        type: 'status',
                        value,
                        id: ticket.id,
                        title: `Update ticket status to ${value}?`,
                        description: 'Add an admin note if you want to preserve handoff context for this status change.'
                      });
                      event.target.value = '';
                    }}
                  >
                    <option value="">Change status</option>
                    {TICKET_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <select
                    value=""
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) return;
                      setActionState({
                        entity: 'ticket',
                        type: 'priority',
                        value,
                        id: ticket.id,
                        title: `Change ticket priority to ${value}?`,
                        description: 'Add an admin note if this priority change needs explanation.'
                      });
                      event.target.value = '';
                    }}
                  >
                    <option value="">Change priority</option>
                    {TICKET_PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>

        <AdminPagination page={pagination.page} totalPages={pagination.totalPages} onChange={(page) => setTicketFilters((prev) => ({ ...prev, page }))} />
      </>
    );
  }

  function renderFeedback() {
    if (loading) return <AdminLoadingState label="Loading feedback..." />;
    if (!feedbackEntries.length) {
      return <AdminEmptyState title="No feedback found" description="No platform feedback intake exists in the app yet, so this page stays empty until real feedback records are created." />;
    }

    return (
      <>
        <AdminTable columns={['Feedback item', 'Type', 'User', 'Message', 'Rating', 'Status', 'Created', 'Actions']} minWidth={1300}>
          {feedbackEntries.map((entry) => (
            <tr key={entry.id}>
              <td>
                <button type="button" className="admin-link-button" onClick={() => openFeedback(entry.id)}>
                  {entry.itemTitle || 'General platform feedback'}
                </button>
              </td>
              <td><AdminBadge tone="neutral">{entry.itemType}</AdminBadge></td>
              <td>
                <strong>{entry.user?.name || 'Anonymous user'}</strong>
                <div className="admin-table__muted">{entry.user?.email || 'No email'}</div>
              </td>
              <td>{entry.message}</td>
              <td>{entry.rating ?? 'N/A'}</td>
              <td><AdminBadge tone={toneForStatus(entry.status)}>{entry.status}</AdminBadge></td>
              <td>{formatDate(entry.createdAt)}</td>
              <td>
                <div className="admin-table__actions">
                  <AdminActionButton variant="ghost" onClick={() => openFeedback(entry.id)}>View</AdminActionButton>
                  <AdminActionButton tone="info" variant="ghost" onClick={() => setActionState({
                    entity: 'feedback',
                    type: 'status',
                    value: 'reviewed',
                    id: entry.id,
                    title: 'Mark feedback reviewed?',
                    description: 'Use this when an admin has completed the initial review.'
                  })}>
                    Review
                  </AdminActionButton>
                  <AdminActionButton tone="default" variant="ghost" onClick={() => setActionState({
                    entity: 'feedback',
                    type: 'status',
                    value: 'dismissed',
                    id: entry.id,
                    title: 'Dismiss this feedback?',
                    description: 'Use this when no follow-up action is needed.'
                  })}>
                    Dismiss
                  </AdminActionButton>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>

        <AdminPagination page={pagination.page} totalPages={pagination.totalPages} onChange={(page) => setFeedbackFilters((prev) => ({ ...prev, page }))} />
      </>
    );
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        title="Support"
        description="Manage support tickets and review feedback while keeping the current product flows untouched until dedicated user-facing intake screens are added."
        badge={{ label: `${pagination.total} records`, tone: 'info' }}
        tabs={tabs}
      />

      {renderSummaryCards()}

      <section className="admin-panel">
        <div className="admin-toolbar">
          <label className="admin-field admin-field--search">
            <span>Search</span>
            <input
              value={activeView === 'feedback' ? feedbackFilters.search : ticketFilters.search}
              onChange={(event) => {
                const value = event.target.value;
                if (activeView === 'feedback') {
                  setFeedbackFilters((prev) => ({ ...prev, search: value, page: 1 }));
                } else {
                  setTicketFilters((prev) => ({ ...prev, search: value, page: 1 }));
                }
              }}
              placeholder={activeView === 'feedback' ? 'Item title or message' : 'Ticket title or message'}
            />
          </label>

          <label className="admin-field">
            <span>Status</span>
            <select
              value={activeView === 'feedback' ? feedbackFilters.status : ticketFilters.status}
              onChange={(event) => {
                const value = event.target.value;
                if (activeView === 'feedback') {
                  setFeedbackFilters((prev) => ({ ...prev, status: value, page: 1 }));
                } else {
                  setTicketFilters((prev) => ({ ...prev, status: value, page: 1 }));
                }
              }}
            >
              <option value="">All statuses</option>
              {(activeView === 'feedback' ? FEEDBACK_STATUS_OPTIONS : TICKET_STATUS_OPTIONS).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          {activeView === 'feedback' ? (
            <label className="admin-field">
              <span>Item type</span>
              <select value={feedbackFilters.itemType} onChange={(event) => setFeedbackFilters((prev) => ({ ...prev, itemType: event.target.value, page: 1 }))}>
                <option value="">All item types</option>
                {FEEDBACK_TYPE_OPTIONS.map((itemType) => (
                  <option key={itemType} value={itemType}>{itemType}</option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="admin-field">
                <span>Priority</span>
                <select value={ticketFilters.priority} onChange={(event) => setTicketFilters((prev) => ({ ...prev, priority: event.target.value, page: 1 }))}>
                  <option value="">All priorities</option>
                  {TICKET_PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Category</span>
                <select value={ticketFilters.category} onChange={(event) => setTicketFilters((prev) => ({ ...prev, category: event.target.value, page: 1 }))}>
                  <option value="">All categories</option>
                  {TICKET_CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className="admin-field">
            <span>Created from</span>
            <input
              type="date"
              value={activeView === 'feedback' ? feedbackFilters.createdFrom : ticketFilters.createdFrom}
              onChange={(event) => {
                const value = event.target.value;
                if (activeView === 'feedback') {
                  setFeedbackFilters((prev) => ({ ...prev, createdFrom: value, page: 1 }));
                } else {
                  setTicketFilters((prev) => ({ ...prev, createdFrom: value, page: 1 }));
                }
              }}
            />
          </label>

          <label className="admin-field">
            <span>Created to</span>
            <input
              type="date"
              value={activeView === 'feedback' ? feedbackFilters.createdTo : ticketFilters.createdTo}
              onChange={(event) => {
                const value = event.target.value;
                if (activeView === 'feedback') {
                  setFeedbackFilters((prev) => ({ ...prev, createdTo: value, page: 1 }));
                } else {
                  setTicketFilters((prev) => ({ ...prev, createdTo: value, page: 1 }));
                }
              }}
            />
          </label>
        </div>

        {activeView === 'feedback' ? renderFeedback() : renderTickets()}
      </section>

      <AdminSupportTicketDrawer
        ticket={selectedTicket}
        open={Boolean(selectedTicketId)}
        loading={detailsLoading && Boolean(selectedTicketId)}
        onClose={() => {
          setSelectedTicketId('');
          setSelectedTicket(null);
        }}
        onUpdateStatus={() => setActionState({
          entity: 'ticket',
          type: 'status',
          value: 'in_progress',
          id: selectedTicketId,
          title: 'Update ticket status?',
          description: 'Add a note if you want to preserve context while changing the ticket status.',
          requireReason: false
        })}
        onUpdatePriority={() => setActionState({
          entity: 'ticket',
          type: 'priority',
          value: 'urgent',
          id: selectedTicketId,
          title: 'Change ticket priority?',
          description: 'Add a note if you want to record why this priority changed.',
          requireReason: false
        })}
        onReply={() => setActionState({
          entity: 'ticket',
          type: 'reply',
          id: selectedTicketId,
          title: 'Reply to this ticket?',
          description: 'Your reply will be stored in the ticket conversation.',
          requireReason: true
        })}
        onAddNote={() => setActionState({
          entity: 'ticket',
          type: 'note',
          id: selectedTicketId,
          title: 'Add an admin note?',
          description: 'This note stays internal to the support workflow.',
          requireReason: true
        })}
        onDelete={() => setActionState({
          entity: 'ticket',
          type: 'delete',
          id: selectedTicketId,
          title: 'Delete this ticket?',
          description: 'This action cannot be undone. All replies and notes will be permanently removed.',
          requireReason: false
        })}
      />

      <AdminFeedbackDrawer
        feedback={selectedFeedback}
        open={Boolean(selectedFeedbackId)}
        loading={detailsLoading && Boolean(selectedFeedbackId)}
        onClose={() => {
          setSelectedFeedbackId('');
          setSelectedFeedback(null);
        }}
        onReview={() => setActionState({
          entity: 'feedback',
          type: 'status',
          value: 'reviewed',
          id: selectedFeedbackId,
          title: 'Mark feedback reviewed?',
          description: 'Add a note if you want to preserve follow-up context.',
          requireReason: false
        })}
        onDismiss={() => setActionState({
          entity: 'feedback',
          type: 'status',
          value: 'dismissed',
          id: selectedFeedbackId,
          title: 'Dismiss this feedback?',
          description: 'Use this when no further action is required.',
          requireReason: false
        })}
        onResolve={() => setActionState({
          entity: 'feedback',
          type: 'status',
          value: 'resolved',
          id: selectedFeedbackId,
          title: 'Resolve this feedback?',
          description: 'Use this when the feedback has been addressed.',
          requireReason: false
        })}
        onAddNote={() => setActionState({
          entity: 'feedback',
          type: 'note',
          id: selectedFeedbackId,
          title: 'Add a feedback note?',
          description: 'This note stays internal to the feedback workflow.',
          requireReason: true
        })}
      />

      <AdminConfirmModal
        open={Boolean(actionState)}
        title={actionState?.title}
        description={actionState?.description}
        requireReason={actionState?.requireReason}
        reasonLabel={actionState?.type === 'reply' ? 'Reply message' : 'Admin note'}
        confirmLabel="Save update"
        onClose={() => setActionState(null)}
        onConfirm={handleConfirmAction}
      />
    </section>
  );
}
