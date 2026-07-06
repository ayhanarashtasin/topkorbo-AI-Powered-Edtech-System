import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import AdminActionButton from '../components/AdminActionButton';
import AdminBadge from '../components/AdminBadge';
import AdminBookDetailsDrawer from '../components/AdminBookDetailsDrawer';
import AdminConfirmModal from '../components/AdminConfirmModal';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPagination from '../components/AdminPagination';
import AdminTable from '../components/AdminTable';
import {
  approveAdminBook,
  fetchAdminBookDetails,
  fetchAdminBooks,
  rejectAdminBook
} from '../services/adminApi';

const STATUS_OPTIONS = ['pending', 'approved', 'rejected'];
const RAG_STATUS_OPTIONS = ['pending', 'not_started', 'extracting_text', 'chunking', 'embedding', 'indexing', 'completed', 'failed'];
const CATEGORY_OPTIONS = ['Academic', 'Admission'];

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

function toneForRagStatus(status) {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  if (['indexing', 'embedding', 'chunking', 'extracting_text'].includes(status)) return 'info';
  if (['pending', 'not_started'].includes(status)) return 'warning';
  return 'neutral';
}

export default function AdminBooksPage() {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    category: '',
    ragStatus: '',
    page: 1,
    limit: 10
  });
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionState, setActionState] = useState(null);

  async function loadData(nextFilters = filters) {
    try {
      setLoading(true);
      const data = await fetchAdminBooks(nextFilters);
      setBooks(data?.items || []);
      setStats(data?.stats || { pending: 0, approved: 0, rejected: 0 });
      setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      toast.error(err.message || 'Failed to load books');
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
  }, [filters.page, filters.status, filters.category, filters.ragStatus]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadData({ ...filters, page: 1 });
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  async function openBook(bookId) {
    setSelectedBookId(bookId);
    setDetailsLoading(true);
    try {
      const data = await fetchAdminBookDetails(bookId);
      setSelectedBook(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load book details');
    } finally {
      setDetailsLoading(false);
    }
  }

  async function refreshSelectedBook(bookId = selectedBookId) {
    if (!bookId) return;
    const data = await fetchAdminBookDetails(bookId);
    setSelectedBook(data);
  }

  async function handleActionConfirm(reason) {
    try {
      if (actionState?.type === 'approve') {
        await approveAdminBook(actionState.bookId, { reason });
        toast.success('Book approved');
      } else if (actionState?.type === 'reject') {
        await rejectAdminBook(actionState.bookId, { reason });
        toast.success('Book rejected');
      }

      const currentId = actionState?.bookId;
      setActionState(null);
      await loadData();
      if (selectedBookId === currentId) {
        await refreshSelectedBook(currentId);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update book approval');
    }
  }

  const activeBadge = useMemo(() => `${pagination.total} books`, [pagination.total]);

  return (
    <section className="admin-page">
      <AdminPageHeader
        title="Book Approval"
        description="Review teacher-uploaded reading books, preview chapter PDFs, and control whether books become visible in student Reading Books."
        badge={{ label: activeBadge, tone: 'info' }}
      />

      <section className="admin-panel">
        <div className="admin-panel__header">
          <div>
            <h3>Approval queue</h3>
            <p className="admin-panel__subtext">Legacy books stay available, while new teacher uploads can move through pending, approved, and rejected states.</p>
          </div>
          <div className="admin-chip-row">
            <AdminBadge tone="warning" size="sm">{stats.pending || 0} pending</AdminBadge>
            <AdminBadge tone="success" size="sm">{stats.approved || 0} approved</AdminBadge>
            <AdminBadge tone="danger" size="sm">{stats.rejected || 0} rejected</AdminBadge>
          </div>
        </div>

        <div className="admin-toolbar">
          <label className="admin-field admin-field--search">
            <span>Search</span>
            <input
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
              placeholder="Search title, subject, category, or teacher"
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
            <span>Category</span>
            <select value={filters.category} onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value, page: 1 }))}>
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>RAG status</span>
            <select value={filters.ragStatus} onChange={(event) => setFilters((prev) => ({ ...prev, ragStatus: event.target.value, page: 1 }))}>
              <option value="">All RAG states</option>
              {RAG_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="admin-page-loader"><div className="admin-spinner" /><p>Loading books...</p></div>
        ) : books.length === 0 ? (
          <AdminEmptyState
            title="No books found"
            description="Try changing the status, category, or RAG filters to broaden the approval queue."
          />
        ) : (
          <>
            <AdminTable
              columns={['Book', 'Teacher', 'Subject / Category', 'Uploaded', 'Status', 'Pages', 'RAG', 'Actions']}
              minWidth={1240}
            >
              {books.map((book) => (
                <tr key={book.id}>
                  <td>
                    <button type="button" className="admin-link-button" onClick={() => openBook(book.id)}>
                      {book.title}
                    </button>
                    <div className="admin-table__muted">{book.description || 'No description provided'}</div>
                  </td>
                  <td>
                    <strong>{book.uploadedBy?.name || 'Unknown teacher'}</strong>
                    <div className="admin-table__muted">{book.uploadedBy?.email || 'N/A'}</div>
                  </td>
                  <td>
                    <strong>{book.subject || 'N/A'}</strong>
                    <div className="admin-table__muted">{[book.category, book.group, book.paper].filter(Boolean).join(' / ') || 'N/A'}</div>
                  </td>
                  <td>{formatDate(book.createdAt)}</td>
                  <td><AdminBadge tone={toneForStatus(book.approvalStatus)}>{book.approvalStatus}</AdminBadge></td>
                  <td>{book.totalPages || 0}</td>
                  <td><AdminBadge tone={toneForRagStatus(book.ragStatus)}>{book.ragStatus || 'pending'}</AdminBadge></td>
                  <td>
                    <div className="admin-table__actions">
                      <AdminActionButton variant="ghost" onClick={() => openBook(book.id)}>View</AdminActionButton>
                      {book.previewUrl || book.previewApiUrl ? (
                        <AdminActionButton variant="ghost" onClick={() => window.open(book.previewUrl || book.previewApiUrl, '_blank', 'noopener,noreferrer')}>
                          Preview PDF
                        </AdminActionButton>
                      ) : null}
                      {book.approvalStatus !== 'approved' ? (
                        <AdminActionButton onClick={() => setActionState({
                          type: 'approve',
                          bookId: book.id,
                          title: `Approve ${book.title}?`,
                          description: 'This will make the book visible in student Reading Books if it is published.'
                        })}
                        >
                          Approve
                        </AdminActionButton>
                      ) : null}
                      {book.approvalStatus !== 'rejected' ? (
                        <AdminActionButton tone="danger" variant="ghost" onClick={() => setActionState({
                          type: 'reject',
                          bookId: book.id,
                          title: `Reject ${book.title}?`,
                          description: 'Rejected books stay hidden from students. Add a reason so the teacher has clear feedback.',
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

            <AdminPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onChange={(page) => setFilters((prev) => ({ ...prev, page }))}
            />
          </>
        )}
      </section>

      <AdminBookDetailsDrawer
        book={selectedBook}
        open={Boolean(selectedBookId)}
        loading={detailsLoading}
        onClose={() => {
          setSelectedBookId('');
          setSelectedBook(null);
        }}
        onApprove={() => setActionState({
          type: 'approve',
          bookId: selectedBookId,
          title: `Approve ${selectedBook?.title || 'this book'}?`,
          description: 'This will make the book visible in student Reading Books if it is published.'
        })}
        onReject={() => setActionState({
          type: 'reject',
          bookId: selectedBookId,
          title: `Reject ${selectedBook?.title || 'this book'}?`,
          description: 'Rejected books stay hidden from students. Add a reason so the teacher has clear feedback.',
          requireReason: true
        })}
      />

      <AdminConfirmModal
        open={Boolean(actionState)}
        title={actionState?.title || ''}
        description={actionState?.description || ''}
        requireReason={Boolean(actionState?.requireReason)}
        reasonLabel="Reviewer note"
        confirmLabel={actionState?.type === 'reject' ? 'Reject book' : 'Approve book'}
        onClose={() => setActionState(null)}
        onConfirm={handleActionConfirm}
      />
    </section>
  );
}
