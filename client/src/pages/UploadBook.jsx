import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import {
  HiDocumentText,
  HiCheckCircle
} from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import toast from 'react-hot-toast';
import './UploadBook.css';

const CATEGORY_OPTIONS = [
  { id: 'Academic', labelEn: 'Academic', labelBn: 'একাডেমিক' },
  { id: 'Admission', labelEn: 'Admission', labelBn: 'ভর্তি পরীক্ষা' }
];

const GROUP_OPTIONS = [
  { id: 'Science', labelEn: 'Science', labelBn: 'বিজ্ঞান' },
  { id: 'Arts', labelEn: 'Arts', labelBn: 'মানবিক' },
  { id: 'Commerce', labelEn: 'Commerce', labelBn: 'ব্যবসায় শিক্ষা' }
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

const PAPER_OPTIONS = [
  { id: '1st', labelEn: '1st Paper', labelBn: '১ম পত্র' },
  { id: '2nd', labelEn: '2nd Paper', labelBn: '২য় পত্র' },
  { id: 'N/A', labelEn: 'N/A', labelBn: 'প্রযোজ্য নয়' }
];

export default function UploadBook() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookId = searchParams.get('bookId');
  const { t, language } = useLanguage();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || '',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [group, setGroup] = useState('');
  const [subject, setSubject] = useState('');
  const [paper, setPaper] = useState('');
  const [chapterNumber, setChapterNumber] = useState('1');
  const [chapterTitle, setChapterTitle] = useState('Chapter 1');
  const [firstPdf, setFirstPdf] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const activeTab = 'reading-books';

  // Verify the session and load the current user so we can gate teacher-only actions.
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) { window.location.href = '/'; return; }
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
            name: data.data.name,
            avatar: data.data.avatar || '',
            email: data.data.email,
            role: data.data.role
          });
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

  // When editing an existing book, fetch its metadata and prefill the form.
  useEffect(() => {
    if (!bookId) return;
    const token = localStorage.getItem('topkorbo_token');
    const fetchBookDetails = async () => {
      try {
        const res = await fetch(`${apiBase}/books/${bookId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.data) {
          const b = data.data;
          setTitle(b.title || '');
          setDescription(b.description || '');
          setCategory(b.category || '');
          setGroup(b.group || '');
          setSubject(b.subject || '');
          setPaper(b.paper || '');
        } else {
          toast.error(data.message || (language === 'en' ? 'Failed to load book details' : 'বইয়ের তথ্য লোড করতে ব্যর্থ হয়েছে'));
        }
      } catch (err) {
        console.error('Error fetching book:', err);
        toast.error(language === 'en' ? 'Error loading book details' : 'বইয়ের তথ্য লোড করার সময় ত্রুটি');
      }
    };
    fetchBookDetails();
  }, [bookId, apiBase, language]);

  const isTeacher = user.role === 'teacher';

  const handlePublish = async () => {
    if (!isTeacher) return;
    if (submitting) return;

    if (!title.trim() || title.trim().length < 3) {
      toast.error(language === 'en' ? 'Writer name must be at least 3 characters' : 'লেখকের নাম কমপক্ষে ৩টি অক্ষর হতে হবে');
      return;
    }
    if (!category || !group || !subject || !paper) {
      toast.error(language === 'en' ? 'Please fill all required fields' : 'সব আবশ্যক ফিল্ড পূরণ করুন');
      return;
    }
    if (!bookId) {
      if (!chapterNumber.trim() || !chapterTitle.trim()) {
        toast.error(language === 'en' ? 'Please fill all required fields' : 'সব আবশ্যক ফিল্ড পূরণ করুন');
        return;
      }
      if (!firstPdf) {
        toast.error(t('rb.upload.error.pdf'));
        return;
      }
    }

    setSubmitting(true);
    const token = localStorage.getItem('topkorbo_token');

    try {
      let res;
      if (bookId) {
        res = await fetch(`${apiBase}/books/${bookId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            category,
            group,
            subject,
            paper
          })
        });
      } else {
        const fd = new FormData();
        fd.append('title', title.trim());
        fd.append('description', description.trim());
        fd.append('category', category);
        fd.append('group', group);
        fd.append('subject', subject);
        fd.append('paper', paper);
        fd.append('chapterNumber', chapterNumber.trim());
        fd.append('chapterTitle', chapterTitle.trim());
        fd.append('pdf', firstPdf);

        res = await fetch(`${apiBase}/books`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd
        });
      }

      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || (language === 'en' ? 'Operation failed' : 'অপারেশন ব্যর্থ'));
        setSubmitting(false);
        return;
      }

      toast.success(bookId ? (language === 'en' ? 'Book updated successfully' : 'বই সফলভাবে আপডেট করা হয়েছে') : t('rb.upload.success'));
      navigate('/reading-books', { state: { refreshAt: Date.now() } });
    } catch (err) {
      console.error('Operation error:', err);
      toast.error(language === 'en' 
        ? `Network error: ${err.message}` 
        : `নেটওয়ার্ক ত্রুটি: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isTeacher) {
    return (
      <div className="dashboard-container">
        <Sidebar activeTab={activeTab} user={user} />
        <main className="dashboard-main">
          <div className="rb-upload-locked">
            <h2>{language === 'en' ? 'Teacher access required' : 'শিক্ষক অ্যাকাউন্ট আবশ্যক'}</h2>
            <p>
              {language === 'en'
                ? 'Only verified teachers can upload books. Apply to become a teacher to publish reading material.'
                : 'শুধুমাত্র অনুমোদিত শিক্ষকরা বই আপলোড করতে পারবেন। শিক্ষক হিসেবে আবেদন করুন।'}
            </p>
            <button
              type="button"
              className="rb-upload-locked__cta"
              onClick={() => navigate('/teacher')}
            >
              {language === 'en' ? 'Apply to become a teacher' : 'শিক্ষক হিসেবে আবেদন করুন'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <Sidebar activeTab={activeTab} user={user} />
      <main className="dashboard-main">
        <header className="dashboard-header rb-header">
          <div className="dashboard-header__welcome">
            <h2>
              <HiDocumentText style={{ verticalAlign: 'middle', marginRight: 8 }} />
              {bookId ? (language === 'en' ? 'Edit Book Information' : 'বইয়ের তথ্য পরিবর্তন') : t('rb.upload.title')}
            </h2>
            <p>{bookId ? (language === 'en' ? 'Update the metadata for this book.' : 'এই বইটির বিবরণ পরিবর্তন করুন।') : t('rb.upload.subtitle')}</p>
          </div>
        </header>

        <div className="rb-workspace rb-upload-workspace animate-fade-in">
          <div className="rb-upload-step">
            <div className="rb-form-grid">
              {/* Writer Name of the Book */}
              <div className="rb-form-field rb-form-field--full">
                <label className="rb-form-label">
                  {language === 'en' ? 'Writer Name of the Book *' : 'বইয়ের লেখকের নাম *'}
                </label>
                <input
                  type="text"
                  className="rb-form-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={language === 'en' ? 'e.g. Dr. Shahjahan Tapan' : 'যেমন: ড. শাহজাহান তপন'}
                />
              </div>

              {/* Description */}
              <div className="rb-form-field rb-form-field--full">
                <label className="rb-form-label">{t('rb.upload.field.description')}</label>
                <textarea
                  className="rb-form-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder={language === 'en' ? 'Optional summary of the book' : 'ঐচ্ছিক সারসংক্ষেপ'}
                />
              </div>

              {/* Category */}
              <div className="rb-form-field">
                <label className="rb-form-label">{t('rb.upload.field.category')} *</label>
                <select className="rb-form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">{language === 'en' ? 'Select…' : 'নির্বাচন করুন…'}</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {language === 'en' ? c.labelEn : c.labelBn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Academic stream — drives the available subject list below. */}
              <div className="rb-form-field">
                <label className="rb-form-label">{t('rb.upload.field.group')} *</label>
                <select
                  className="rb-form-select"
                  value={group}
                  onChange={(e) => {
                    setGroup(e.target.value);
                    // Clear the subject so it doesn't reference a group that no longer matches.
                    setSubject('');
                  }}
                >
                  <option value="">{language === 'en' ? 'Select…' : 'নির্বাচন করুন…'}</option>
                  {GROUP_OPTIONS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {language === 'en' ? g.labelEn : g.labelBn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject — disabled until a group is selected, since subjects are grouped. */}
              <div className="rb-form-field">
                <label className="rb-form-label">{t('rb.upload.field.subject')} *</label>
                <select
                  className="rb-form-select"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={!group}
                >
                  <option value="">
                    {!group
                      ? (language === 'en' ? 'Select group first…' : 'প্রথমে গ্রুপ নির্বাচন করুন…')
                      : (language === 'en' ? 'Select Subject…' : 'বিষয় নির্বাচন করুন…')}
                  </option>
                  {group && SUBJECT_OPTIONS_BY_GROUP[group]?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {language === 'en' ? s.labelEn : s.labelBn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Paper (1st / 2nd / N/A) — only used for subjects split across papers. */}
              <div className="rb-form-field">
                <label className="rb-form-label">{t('rb.upload.field.paper')} *</label>
                <select className="rb-form-select" value={paper} onChange={(e) => setPaper(e.target.value)}>
                  <option value="">{language === 'en' ? 'Select…' : 'নির্বাচন করুন…'}</option>
                  {PAPER_OPTIONS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {language === 'en' ? p.labelEn : p.labelBn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chapter number — only shown while creating a brand-new book. */}
              {!bookId && (
                <div className="rb-form-field">
                  <label className="rb-form-label">{t('rb.upload.field.chapter_number')} *</label>
                  <input
                    type="text"
                    className="rb-form-input"
                    value={chapterNumber}
                    onChange={(e) => setChapterNumber(e.target.value)}
                    placeholder={language === 'en' ? 'e.g. 1' : 'যেমন: ১'}
                  />
                </div>
              )}

              {!bookId && (
                <div className="rb-form-field">
                  <label className="rb-form-label">{t('rb.upload.field.chapter_title')} *</label>
                  <input
                    type="text"
                    className="rb-form-input"
                    value={chapterTitle}
                    onChange={(e) => setChapterTitle(e.target.value)}
                    placeholder={language === 'en' ? 'e.g. Physical World' : 'যেমন: ভৌত জগৎ'}
                  />
                </div>
              )}

              {!bookId && (
                <div className="rb-form-field rb-form-field--full">
                  <label className="rb-form-label">{t('rb.upload.field.first_pdf')} *</label>
                  <FileInput
                    onFile={setFirstPdf}
                    file={firstPdf}
                    id="rb-first-pdf"
                  />
                </div>
              )}
            </div>

            <div className="rb-step-actions" style={{ borderTop: '1px solid var(--bg-accent-warm, #F7EBE1)', marginTop: 28 }}>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className="rb-btn rb-btn--primary"
                onClick={handlePublish}
                disabled={submitting}
              >
                {submitting ? (
                  <span>{bookId ? (language === 'en' ? 'Saving…' : 'সংরক্ষণ হচ্ছে…') : (language === 'en' ? 'Publishing…' : 'প্রকাশ হচ্ছে…')}</span>
                ) : (
                  <>
                    <HiCheckCircle size={16} />
                    <span>{bookId ? (language === 'en' ? 'Save Changes' : 'পরিবর্তন সংরক্ষণ করুন') : t('rb.upload.publish')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function FileInput({ onFile, file, id }) {
  const [filename, setFilename] = useState(file ? file.name : '');
  useEffect(() => { setFilename(file ? file.name : ''); }, [file]);
  return (
    <div className="rb-file-input">
      <input
        id={id}
        type="file"
        accept="application/pdf"
        onChange={(e) => {
          const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
          onFile(f);
        }}
        className="rb-file-input__native"
      />
      <label htmlFor={id} className="rb-file-input__label">
        <HiDocumentText size={16} />
        <span>{filename || (window.innerWidth > 600 ? 'Choose PDF' : 'PDF')}</span>
      </label>
      {filename && (
        <span className="rb-file-input__filename" title={filename}>
          {filename}
        </span>
      )}
    </div>
  );
}
