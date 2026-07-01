import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import {
  HiSearch,
  HiLibrary,
  HiArrowRight,
  HiCog,
  HiDocumentText,
  HiPlusCircle,
  HiX,
  HiTrash
} from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import toast from 'react-hot-toast';
import './ReadingBooks.css';

const CATEGORY_OPTIONS = [
  { id: 'Academic', labelEn: 'Academic', labelBn: 'একাডেমিক' },
  { id: 'Admission', labelEn: 'Admission', labelBn: 'ভর্তি পরীক্ষা' }
];

const GROUP_OPTIONS = [
  { id: 'Science', labelEn: 'Science', labelBn: 'বিজ্ঞান' },
  { id: 'Arts', labelEn: 'Arts', labelBn: 'মানবিক' },
  { id: 'Commerce', labelEn: 'Commerce', labelBn: 'ব্যবসায় শিক্ষা' }
];

const PAPER_OPTIONS = [
  { id: '1st', labelEn: '1st Paper', labelBn: '১ম পত্র' },
  { id: '2nd', labelEn: '2nd Paper', labelBn: '২য় পত্র' },
  { id: 'N/A', labelEn: 'N/A', labelBn: 'প্রযোজ্য নয়' }
];

const SUBJECT_OPTIONS_BY_GROUP = {
  Science: [
    { id: 'Physics', labelEn: 'Physics', labelBn: 'পদার্থবিজ্ঞান' },
    { id: 'Chemistry', labelEn: 'Chemistry', labelBn: 'রসায়ন' },
    { id: 'Biology', labelEn: 'Biology', labelBn: 'জীববিজ্ঞান' },
    { id: 'Higher Mathematics', labelEn: 'Higher Mathematics', labelBn: 'উচ্চতর গণিত' },
    { id: 'Bangla', labelEn: 'Bangla', labelBn: 'বাংলা' },
    { id: 'English', labelEn: 'English', labelBn: 'ইংরেজি' },
    { id: 'ICT', labelEn: 'ICT', labelBn: 'তথ্য ও যোগাযোগ প্রযুক্তি' }
  ],
  Arts: [
    { id: 'History', labelEn: 'History', labelBn: 'ইতিহাস' },
    { id: 'Islamic History & Culture', labelEn: 'Islamic History & Culture', labelBn: 'ইসলামের ইতিহাস ও সংস্কৃতি' },
    { id: 'Civics & Good Governance', labelEn: 'Civics & Good Governance', labelBn: 'পৌরনীতি ও সুশাসন' },
    { id: 'Economics', labelEn: 'Economics', labelBn: 'অর্থনীতি' },
    { id: 'Logic', labelEn: 'Logic', labelBn: 'যুক্তিবিদ্যা' },
    { id: 'Geography', labelEn: 'Geography', labelBn: 'ভূগোল' },
    { id: 'Sociology', labelEn: 'Sociology', labelBn: 'সমাজবিজ্ঞান' },
    { id: 'Social Work', labelEn: 'Social Work', labelBn: 'সমাজকর্ম' },
    { id: 'Bangla', labelEn: 'Bangla', labelBn: 'বাংলা' },
    { id: 'English', labelEn: 'English', labelBn: 'ইংরেজি' },
    { id: 'ICT', labelEn: 'ICT', labelBn: 'তথ্য ও যোগাযোগ প্রযুক্তি' }
  ],
  Commerce: [
    { id: 'Accounting', labelEn: 'Accounting', labelBn: 'হিসাববিজ্ঞান' },
    { id: 'Finance, Banking & Insurance', labelEn: 'Finance, Banking & Insurance', labelBn: 'ফিন্যান্স, ব্যাংকিং ও বিমা' },
    { id: 'Business Organization & Management', labelEn: 'Business Organization & Management', labelBn: 'ব্যবসায় সংগঠন ও ব্যবস্থাপনা' },
    { id: 'Production Management & Marketing', labelEn: 'Production Management & Marketing', labelBn: 'উৎপাদন ব্যবস্থাপনা ও বিপণন' },
    { id: 'Bangla', labelEn: 'Bangla', labelBn: 'বাংলা' },
    { id: 'English', labelEn: 'English', labelBn: 'ইংরেজি' },
    { id: 'ICT', labelEn: 'ICT', labelBn: 'তথ্য ও যোগাযোগ প্রযুক্তি' }
  ]
};

const CATEGORY_GRADIENT = {
  Academic: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
  Admission: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)'
};

export default function ReadingBooks() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useLanguage();

  const [user, setUser] = useState({
    id: localStorage.getItem('topkorbo_id') || '',
    name: localStorage.getItem('topkorbo_name') || 'Student',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });

  const [taxonomy, setTaxonomy] = useState({
    categories: [],
    groups: [],
    subjects: [],
    papers: []
  });
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    group: '',
    subject: '',
    paper: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBookId, setExpandedBookId] = useState(null);
  const [chaptersByBook, setChaptersByBook] = useState({});
  const [loadingChapters, setLoadingChapters] = useState({});
  const [myUploadsOnly, setMyUploadsOnly] = useState(false);
  const [confirmDeleteData, setConfirmDeleteData] = useState({
    show: false,
    bookId: null
  });

  const activeTab = 'reading-books';
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Load the current user from /auth/me and cache it for the rest of the app.
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) {
      window.location.href = '/';
      return;
    }
    const fetchUser = async () => {
      try {
        const res = await fetch(`${apiBase}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) {
          localStorage.removeItem('topkorbo_token');
          window.location.href = '/';
          return;
        }
        const data = await res.json();
        if (data.success && data.data) {
          setUser({
            id: data.data._id,
            name: data.data.name,
            avatar: data.data.avatar || '',
            email: data.data.email,
            role: data.data.role
          });
          localStorage.setItem('topkorbo_id', data.data._id);
          localStorage.setItem('topkorbo_name', data.data.name);
          localStorage.setItem('topkorbo_avatar', data.data.avatar || '');
          localStorage.setItem('topkorbo_email', data.data.email);
          localStorage.setItem('topkorbo_role', data.data.role);
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };
    fetchUser();
  }, [apiBase]);

  // Fetch the taxonomy (categories / groups / subjects / papers) once on mount.
  useEffect(() => {
    const fetchTaxonomy = async () => {
      try {
        const token = localStorage.getItem('topkorbo_token');
        const res = await fetch(`${apiBase}/books/taxonomy`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.data) {
          setTaxonomy(data.data);
        }
      } catch (err) {
        console.error('Error fetching taxonomy:', err);
      }
    };
    fetchTaxonomy();
  }, [apiBase]);

  // Re-fetch books whenever filters, the "my uploads" toggle, or the user changes.
  useEffect(() => {
    const fetchBooks = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('topkorbo_token');
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
          if (v) params.append(k, v);
        });
        if (myUploadsOnly && user.role === 'teacher' && user.id) {
          params.append('uploadedBy', user.id);
        }
        const res = await fetch(`${apiBase}/books?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.data) {
          setBooks(data.data.books || []);
        } else {
          setBooks([]);
        }
      } catch (err) {
        console.error('Error fetching books:', err);
        setBooks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchBooks();
  }, [filters, apiBase, myUploadsOnly, user.role, user.id, location.state?.refreshAt]);

  const filteredBooks = useMemo(() => {
    let list = books;
    if (myUploadsOnly && user.role === 'teacher') {
      list = list.filter((b) => {
        if (!b.uploadedBy) return false;
        const uploaderEmail = b.uploadedBy.email;
        const uploaderId = typeof b.uploadedBy === 'object' ? b.uploadedBy._id : b.uploadedBy;
        
        const matchesEmail = uploaderEmail && user.email && uploaderEmail.toLowerCase() === user.email.toLowerCase();
        const matchesId = uploaderId && user.id && String(uploaderId) === String(user.id);
        
        return matchesEmail || matchesId;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.description || '').toLowerCase().includes(q) ||
          b.subject.toLowerCase().includes(q)
      );
    }
    return list;
  }, [books, searchQuery, myUploadsOnly, user]);

  const availableSubjects = useMemo(() => {
    let list = [];
    if (filters.group && SUBJECT_OPTIONS_BY_GROUP[filters.group]) {
      list = SUBJECT_OPTIONS_BY_GROUP[filters.group];
    } else {
      const all = [];
      const seen = new Set();
      Object.values(SUBJECT_OPTIONS_BY_GROUP).forEach((subList) => {
        subList.forEach((s) => {
          if (!seen.has(s.id)) {
            seen.add(s.id);
            all.push(s);
          }
        });
      });
      list = all;
    }

    // Merge in any legacy subjects returned by the taxonomy endpoint so older
    // uploads remain discoverable in the subject filter.
    const seenIds = new Set(list.map((s) => s.id.toLowerCase()));
    const legacy = (taxonomy.subjects || [])
      .filter((s) => s && !seenIds.has(s.toLowerCase()))
      .map((s) => ({ id: s, labelEn: s, labelBn: s }));
      
    return [...list, ...legacy];
  }, [filters.group, taxonomy.subjects]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'group') {
        if (value && SUBJECT_OPTIONS_BY_GROUP[value]) {
          const validIds = SUBJECT_OPTIONS_BY_GROUP[value].map((s) => s.id);
          if (!validIds.includes(prev.subject)) {
            next.subject = '';
          }
        }
      }
      return next;
    });
  };

  const handleResetFilters = () => {
    setFilters({ category: '', group: '', subject: '', paper: '' });
    setSearchQuery('');
  };

  const handleExpandBook = useCallback(async (bookId) => {
    if (expandedBookId === bookId) {
      setExpandedBookId(null);
      return;
    }
    setExpandedBookId(bookId);
    if (chaptersByBook[bookId]) return;
    setLoadingChapters((prev) => ({ ...prev, [bookId]: true }));
    try {
      const token = localStorage.getItem('topkorbo_token');
      const res = await fetch(`${apiBase}/books/${bookId}/chapters`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setChaptersByBook((prev) => ({
          ...prev,
          [bookId]: data.data.chapters || []
        }));
      }
    } catch (err) {
      console.error('Error fetching chapters:', err);
    } finally {
      setLoadingChapters((prev) => ({ ...prev, [bookId]: false }));
    }
  }, [apiBase, expandedBookId, chaptersByBook]);

  const handleOpenChapter = (bookId, chapterId) => {
    navigate(`/reading-books/${bookId}/${chapterId}?page=1`);
  };

  const handleUploadClick = () => {
    if (user.role !== 'teacher') {
      toast.error(
        language === 'en'
          ? 'Only teachers can upload books. Become a teacher first.'
          : 'শুধুমাত্র শিক্ষকরা বই আপলোড করতে পারবেন।'
      );
      return;
    }
    navigate('/reading-books/upload');
  };

  const isOwner = (book) => {
    if (user.role !== 'teacher' || !book.uploadedBy) return false;
    const uploaderEmail = book.uploadedBy.email;
    const uploaderId = typeof book.uploadedBy === 'object' ? book.uploadedBy._id : book.uploadedBy;
    return (uploaderEmail && uploaderEmail === user.email) || (uploaderId && String(uploaderId) === String(user.id));
  };

  const handleEditBook = (bookId) => {
    navigate(`/reading-books/upload?bookId=${bookId}`);
  };

  const handleDeleteBook = (bookId) => {
    setConfirmDeleteData({ show: true, bookId });
  };

  const confirmDeleteBook = async () => {
    const bookId = confirmDeleteData.bookId;
    if (!bookId) return;

    try {
      const token = localStorage.getItem('topkorbo_token');
      const res = await fetch(`${apiBase}/books/${bookId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success(language === 'en' ? 'Book deleted successfully' : 'বইটি সফলভাবে মুছে ফেলা হয়েছে');
        setBooks((prev) => prev.filter((b) => b._id !== bookId));
      } else {
        toast.error(data.message || (language === 'en' ? 'Failed to delete book' : 'বইটি মুছে ফেলতে ব্যর্থ হয়েছে'));
      }
    } catch (err) {
      console.error('Error deleting book:', err);
      toast.error(language === 'en' ? 'Error deleting book' : 'বইটি মুছে ফেলার সময় ত্রুটি ঘটেছে');
    } finally {
      setConfirmDeleteData({ show: false, bookId: null });
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar activeTab={activeTab} user={user} />
      <main className="dashboard-main">
        <header className="dashboard-header rb-header">
          <div className="dashboard-header__welcome">
            <h2>
              <HiLibrary style={{ verticalAlign: 'middle', marginRight: 8 }} />
              {t('rb.title')}
            </h2>
            <p>{t('rb.subtitle')}</p>
          </div>
          <div className="dashboard-header__actions">
            {user.role === 'teacher' && (
              <button
                type="button"
                className="rb-upload-cta"
                onClick={handleUploadClick}
              >
                <HiPlusCircle size={18} />
                <span>{t('rb.upload_cta')}</span>
              </button>
            )}
            <span className="dashboard-header__badge">{t('db.workspace')}</span>
          </div>
        </header>

        <div className="rb-workspace animate-fade-in">
          <div className="rb-filters">
            <div className="rb-filter-group">
              <label className="rb-filter-label">{t('rb.filter.category')}</label>
              <select
                className="rb-filter-select"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
              >
                <option value="">{t('rb.filter.all')}</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {language === 'en' ? c.labelEn : c.labelBn}
                  </option>
                ))}
              </select>
            </div>

            <div className="rb-filter-group">
              <label className="rb-filter-label">{t('rb.filter.group')}</label>
              <select
                className="rb-filter-select"
                value={filters.group}
                onChange={(e) => handleFilterChange('group', e.target.value)}
              >
                <option value="">{t('rb.filter.all')}</option>
                {GROUP_OPTIONS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {language === 'en' ? g.labelEn : g.labelBn}
                  </option>
                ))}
              </select>
            </div>

            <div className="rb-filter-group">
              <label className="rb-filter-label">{t('rb.filter.subject')}</label>
              <select
                className="rb-filter-select"
                value={filters.subject}
                onChange={(e) => handleFilterChange('subject', e.target.value)}
              >
                <option value="">{t('rb.filter.all')}</option>
                {availableSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {language === 'en' ? s.labelEn : s.labelBn}
                  </option>
                ))}
              </select>
            </div>

            <div className="rb-filter-group">
              <label className="rb-filter-label">{t('rb.filter.paper')}</label>
              <select
                className="rb-filter-select"
                value={filters.paper}
                onChange={(e) => handleFilterChange('paper', e.target.value)}
              >
                <option value="">{t('rb.filter.all')}</option>
                {PAPER_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {language === 'en' ? p.labelEn : p.labelBn}
                  </option>
                ))}
              </select>
            </div>

            <div className="rb-search-group">
              <HiSearch size={16} className="rb-search-icon" />
              <input
                type="text"
                className="rb-search-input"
                placeholder={
                  language === 'en' ? 'Search books…' : 'বই খুঁজুন…'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {(filters.category || filters.group || filters.subject || filters.paper || searchQuery) && (
              <button
                type="button"
                className="rb-filter-reset"
                onClick={handleResetFilters}
              >
                <HiX size={14} />
                <span>{language === 'en' ? 'Clear' : 'মুছুন'}</span>
              </button>
            )}

            {user.role === 'teacher' && (
              <button
                type="button"
                className={`rb-mine-toggle ${myUploadsOnly ? 'rb-mine-toggle--active' : ''}`}
                onClick={() => setMyUploadsOnly((v) => !v)}
              >
                <HiCog size={14} />
                <span>{language === 'en' ? 'My uploads' : 'আমার আপলোড'}</span>
              </button>
            )}
          </div>

          {/* Books grid */}
          {loading ? (
            <div className="rb-empty">
              <p>{language === 'en' ? 'Loading…' : 'লোড হচ্ছে…'}</p>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="rb-empty">
              <HiDocumentText size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>
                {searchQuery || filters.category || filters.group || filters.subject || filters.paper
                  ? t('rb.empty')
                  : t('rb.empty.first')}
              </p>
            </div>
          ) : (
            <div className="rb-grid">
              {filteredBooks.map((book) => (
                <BookCard
                  key={book._id}
                  book={book}
                  language={language}
                  isOwner={isOwner(book)}
                  expanded={expandedBookId === book._id}
                  onExpand={() => handleExpandBook(book._id)}
                  onOpenChapter={(chapterId) => handleOpenChapter(book._id, chapterId)}
                  onEdit={handleEditBook}
                  onDelete={handleDeleteBook}
                  chapters={chaptersByBook[book._id]}
                  loadingChapters={!!loadingChapters[book._id]}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {confirmDeleteData.show && (
        <div className="rb-modal-overlay animate-fade-in" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="rb-modal-card animate-scale-up" style={{
            background: 'var(--bg-card, #FFFFFF)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '440px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid var(--border-color, #F3F4F6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}>
            <div style={{
              background: '#FEF2F2',
              color: '#EF4444',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <HiTrash size={28} />
            </div>

            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text-primary, #1F2937)',
              marginBottom: '10px'
            }}>
              {language === 'en' ? 'Delete Book?' : 'বইটি মুছে ফেলবেন?'}
            </h3>
            
            <p style={{
              fontSize: '0.95rem',
              color: 'var(--text-secondary, #4B5563)',
              lineHeight: '1.5',
              marginBottom: '28px'
            }}>
              {language === 'en' 
                ? 'Are you sure you want to delete this book? This will permanently delete the book and all its chapters.' 
                : 'আপনি কি নিশ্চিত যে এই বইটি মুছে ফেলতে চান? এটি স্থায়ীভাবে বইটি এবং এর সমস্ত অধ্যায় মুছে ফেলবে।'}
            </p>

            <div style={{
              display: 'flex',
              gap: '12px',
              width: '100%'
            }}>
              <button
                type="button"
                onClick={() => setConfirmDeleteData({ show: false, bookId: null })}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #E5E7EB)',
                  background: 'transparent',
                  color: 'var(--text-secondary, #4B5563)',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                {language === 'en' ? 'Cancel' : 'বাতিল'}
              </button>
              <button
                type="button"
                onClick={confirmDeleteBook}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#EF4444',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)',
                  transition: 'background 0.2s'
                }}
              >
                {language === 'en' ? 'Delete' : 'মুছে ফেলুন'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BookCard({ book, language, isOwner, expanded, onExpand, onOpenChapter, onEdit, onDelete, chapters, loadingChapters, t }) {
  const gradient = CATEGORY_GRADIENT[book.category] || CATEGORY_GRADIENT.Academic;
  return (
    <div className={`rb-book-card ${expanded ? 'rb-book-card--expanded' : ''}`}>
      <div className="rb-book-card__cover" style={{ background: gradient }}>
        <HiLibrary size={36} />
        <span className="rb-book-card__category-badge">
          {book.category}
        </span>
        {isOwner && (
          <span className="rb-book-card__owner-badge">
            {language === 'en' ? 'You' : 'আপনার'}
          </span>
        )}
      </div>
      <div className="rb-book-card__body">
        <h3 className="rb-book-card__title">{book.title}</h3>
        <p className="rb-book-card__meta">
          <span>{book.subject}</span>
          {book.paper && book.paper !== 'N/A' && (
            <span> · {language === 'en' ? `Paper ${book.paper}` : `${book.paper} পত্র`}</span>
          )}
          <span> · {book.group}</span>
        </p>
        {book.description && (
          <p className="rb-book-card__description">{book.description}</p>
        )}
        <div className="rb-book-card__footer">
          <div className="rb-book-card__stats">
            <HiDocumentText size={14} />
            <span>
              {book.chapterCount || (book.chapters && book.chapters.length) || 0} {t('rb.chapters')}
            </span>
          </div>
          {book.uploadedBy && (
            <div className="rb-book-card__author">
              {book.uploadedBy.avatar ? (
                <img
                  src={book.uploadedBy.avatar}
                  alt=""
                  className="rb-book-card__avatar"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="rb-book-card__avatar-placeholder">
                  {(book.uploadedBy.name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="rb-book-card__author-name">
                {book.uploadedBy.name || ''}
              </span>
            </div>
          )}
        </div>

        <div className="rb-book-card__actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="rb-book-card__btn rb-book-card__btn--primary"
            onClick={onExpand}
            style={{ flex: 1 }}
          >
            {expanded
              ? (language === 'en' ? 'Hide chapters' : 'অধ্যায় লুকান')
              : (language === 'en' ? 'View chapters' : 'অধ্যায় দেখুন')}
            <HiArrowRight
              size={14}
              style={{
                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}
            />
          </button>

          {isOwner && (
            <>
              <button
                type="button"
                className="rb-book-card__btn rb-book-card__btn--edit"
                title={language === 'en' ? 'Edit book info' : 'তথ্য পরিবর্তন করুন'}
                onClick={() => onEdit(book._id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  borderRadius: '6px',
                  background: 'var(--bg-accent, #EDE9FE)',
                  color: 'var(--color-primary, #6D28D9)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                <HiCog size={16} />
              </button>
              <button
                type="button"
                className="rb-book-card__btn rb-book-card__btn--delete"
                title={language === 'en' ? 'Delete book' : 'মুছে ফেলুন'}
                onClick={() => onDelete(book._id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  borderRadius: '6px',
                  background: '#FEE2E2',
                  color: '#DC2626',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                <HiTrash size={16} />
              </button>
            </>
          )}
        </div>

        {expanded && (
          <div className="rb-book-card__chapters">
            {loadingChapters ? (
              <p className="rb-chapters-loading">{language === 'en' ? 'Loading…' : 'লোড হচ্ছে…'}</p>
            ) : !chapters || chapters.length === 0 ? (
              <p className="rb-chapters-empty">{language === 'en' ? 'No chapters yet.' : 'এখনও কোনো অধ্যায় নেই।'}</p>
            ) : (
              <ul className="rb-chapter-list">
                {chapters.map((c) => (
                  <li key={c._id} className="rb-chapter-item">
                    <span className="rb-chapter-num">{c.order + 1}</span>
                    <span className="rb-chapter-title">{c.title}</span>
                    <button
                      type="button"
                      className="rb-chapter-open-btn"
                      onClick={() => onOpenChapter(c._id)}
                    >
                      <span>{t('rb.open_reader')}</span>
                      <HiArrowRight size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
