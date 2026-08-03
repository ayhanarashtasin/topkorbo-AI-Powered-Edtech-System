import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  HiAdjustments,
  HiArrowDown,
  HiArrowRight,
  HiBookOpen,
  HiDocumentText,
  HiLibrary,
  HiPencilAlt,
  HiPlus,
  HiRefresh,
  HiSearch,
  HiSparkles,
  HiTrash,
  HiX
} from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useLanguage } from '../hooks/useLanguage';
import Sidebar from '../components/layout/Sidebar';
import './ReadingBooks.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

const DEFAULT_USER = {
  id: '',
  name: 'Student',
  avatar: '',
  email: '',
  role: 'student'
};

const FILTER_KEYS = ['category', 'group', 'subject', 'paper'];

function getCachedUser() {
  return {
    id: localStorage.getItem('topkorbo_id') || '',
    name: localStorage.getItem('topkorbo_name') || DEFAULT_USER.name,
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || DEFAULT_USER.role
  };
}

function localize(language, english, bengali) {
  return language === 'en' ? english : bengali;
}

function getOptionLabel(options, value, language) {
  const option = options.find((item) => item.id === value);
  if (!option) return value;
  return language === 'en' ? option.labelEn : option.labelBn;
}

function getStatusLabel(status, language) {
  if (status === 'failed') {
    return localize(language, 'Retrying', 'পুনরায় চেষ্টা হচ্ছে');
  }
  if (['extracting_text', 'chunking', 'embedding', 'indexing'].includes(status)) {
    return localize(language, 'Processing', 'প্রসেস হচ্ছে');
  }
  return localize(language, 'Queued', 'অপেক্ষমাণ');
}

function LibraryHero({ bookCount, language, role, onUpload }) {
  const numberFormatter = React.useMemo(
    () => new Intl.NumberFormat(language === 'en' ? 'en-US' : 'bn-BD'),
    [language]
  );

  return (
    <header className="rb-hero">
      <div className="rb-hero__icon" aria-hidden="true">
        <HiLibrary size={24} />
      </div>

      <div className="rb-hero__copy">
        <div className="rb-hero__eyebrow">
          <HiSparkles aria-hidden="true" size={16} />
          <span>{localize(language, 'TopKorbo Reading Room', 'টপকরবো রিডিং রুম')}</span>
        </div>
        <h1>
          {localize(language, 'Find your next chapter.', 'আপনার পরবর্তী অধ্যায়টি খুঁজুন।')}
        </h1>
        <p>
          {localize(
            language,
            'Open a book by chapter and keep every reading tool in one calm, focused workspace.',
            'অধ্যায় ধরে বই খুলুন এবং মনোযোগ দিয়ে পড়ার সব টুল এক জায়গায় পান।'
          )}
        </p>
      </div>

      <div className="rb-hero__meta">
        <div className="rb-hero__count">
          <strong>{numberFormatter.format(bookCount)}</strong>
          <span>{localize(language, 'Books Available', 'বই আছে')}</span>
        </div>
        <div className="rb-hero__actions">
          <a className="rb-hero__browse" href="#library-catalog">
            <span>{localize(language, 'Browse the Shelf', 'বইয়ের তাক দেখুন')}</span>
            <HiArrowDown aria-hidden="true" size={16} />
          </a>
          {role === 'teacher' ? (
            <button className="rb-hero__upload" type="button" onClick={onUpload}>
              <HiPlus aria-hidden="true" size={18} />
              <span>{localize(language, 'Upload a Book', 'বই আপলোড করুন')}</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function FilterSelect({ id, label, value, options, language, onChange }) {
  return (
    <div className="rb-filter-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{localize(language, 'All', 'সব')}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {language === 'en' ? option.labelEn : option.labelBn}
          </option>
        ))}
      </select>
    </div>
  );
}

function LibraryFilters({
  filters,
  searchQuery,
  language,
  availableSubjects,
  activeFilterCount,
  myUploadsOnly,
  isTeacher,
  onFilterChange,
  onSearchChange,
  onClear,
  onToggleMine
}) {
  return (
    <section className="rb-discovery" aria-labelledby="rb-discovery-title">
      <div className="rb-discovery__heading">
        <div>
          <span className="rb-section-kicker">
            {localize(language, 'Discover', 'খুঁজে নিন')}
          </span>
          <h2 id="rb-discovery-title">
            {localize(language, 'Search the Library', 'লাইব্রেরিতে খুঁজুন')}
          </h2>
        </div>
        {activeFilterCount > 0 ? (
          <button className="rb-clear-filters" type="button" onClick={onClear}>
            <HiX aria-hidden="true" size={16} />
            <span>
              {localize(
                language,
                `Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'Filter' : 'Filters'}`,
                'সব ফিল্টার মুছুন'
              )}
            </span>
          </button>
        ) : null}
      </div>

      <div className="rb-search">
        <HiSearch className="rb-search__icon" aria-hidden="true" size={20} />
        <label className="rb-sr-only" htmlFor="rb-book-search">
          {localize(language, 'Search by title, description, or subject', 'নাম, বিবরণ বা বিষয় দিয়ে বই খুঁজুন')}
        </label>
        <input
          id="rb-book-search"
          name="book-search"
          type="search"
          autoComplete="off"
          placeholder={localize(language, 'Search title, subject, or topic…', 'নাম, বিষয় বা টপিক খুঁজুন…')}
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {searchQuery ? (
          <button
            className="rb-search__clear"
            type="button"
            aria-label={localize(language, 'Clear Search', 'সার্চ মুছুন')}
            onClick={() => onSearchChange('')}
          >
            <HiX aria-hidden="true" size={18} />
          </button>
        ) : null}
      </div>

      <div className="rb-filter-row">
        <div className="rb-filter-row__label" aria-hidden="true">
          <HiAdjustments size={18} />
          <span>{localize(language, 'Refine', 'ফিল্টার')}</span>
        </div>
        <div className="rb-filter-grid">
          <FilterSelect
            id="rb-category-filter"
            label={localize(language, 'Category', 'ক্যাটাগরি')}
            value={filters.category}
            options={CATEGORY_OPTIONS}
            language={language}
            onChange={(value) => onFilterChange('category', value)}
          />
          <FilterSelect
            id="rb-group-filter"
            label={localize(language, 'Group', 'গ্রুপ')}
            value={filters.group}
            options={GROUP_OPTIONS}
            language={language}
            onChange={(value) => onFilterChange('group', value)}
          />
          <FilterSelect
            id="rb-subject-filter"
            label={localize(language, 'Subject', 'বিষয়')}
            value={filters.subject}
            options={availableSubjects}
            language={language}
            onChange={(value) => onFilterChange('subject', value)}
          />
          <FilterSelect
            id="rb-paper-filter"
            label={localize(language, 'Paper', 'পত্র')}
            value={filters.paper}
            options={PAPER_OPTIONS}
            language={language}
            onChange={(value) => onFilterChange('paper', value)}
          />
        </div>
        {isTeacher ? (
          <button
            className="rb-mine-toggle"
            type="button"
            aria-pressed={myUploadsOnly}
            onClick={onToggleMine}
          >
            <HiBookOpen aria-hidden="true" size={17} />
            <span>{localize(language, 'My Uploads', 'আমার আপলোড')}</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

function LibraryLoading({ language }) {
  return (
    <div className="rb-loading" role="status" aria-live="polite">
      <span className="rb-sr-only">
        {localize(language, 'Loading books…', 'বই লোড হচ্ছে…')}
      </span>
      {Array.from({ length: 6 }, (_, index) => (
        <div className="rb-skeleton-card" aria-hidden="true" key={index}>
          <div className="rb-skeleton-card__cover" />
          <div className="rb-skeleton-card__body">
            <span />
            <span />
            <span />
          </div>
        </div>
      ))}
    </div>
  );
}

function LibraryError({ language, onRetry }) {
  return (
    <div className="rb-state rb-state--error" role="alert">
      <div className="rb-state__icon">
        <HiRefresh aria-hidden="true" size={28} />
      </div>
      <h3>{localize(language, 'The Library Did Not Load', 'লাইব্রেরি লোড হয়নি')}</h3>
      <p>
        {localize(
          language,
          'Check your connection, then try loading the books again.',
          'ইন্টারনেট সংযোগ পরীক্ষা করে বইগুলো আবার লোড করুন।'
        )}
      </p>
      <button className="rb-state__action" type="button" onClick={onRetry}>
        <HiRefresh aria-hidden="true" size={17} />
        <span>{localize(language, 'Try Again', 'আবার চেষ্টা করুন')}</span>
      </button>
    </div>
  );
}

function LibraryEmpty({ language, hasFilters, isTeacher, onClear, onUpload }) {
  return (
    <div className="rb-state">
      <div className="rb-state__icon">
        <HiDocumentText aria-hidden="true" size={30} />
      </div>
      <h3>
        {hasFilters
          ? localize(language, 'No Books Match Yet', 'এই খোঁজে কোনো বই মেলেনি')
          : localize(language, 'The Shelf Is Ready', 'বইয়ের তাক প্রস্তুত')}
      </h3>
      <p>
        {hasFilters
          ? localize(
              language,
              'Try a broader subject or clear the current filters.',
              'অন্য বিষয় বেছে দেখুন অথবা বর্তমান ফিল্টারগুলো মুছে দিন।'
            )
          : localize(
              language,
              'Published books will appear here as soon as they are available.',
              'নতুন বই প্রকাশিত হলেই এখানে দেখা যাবে।'
            )}
      </p>
      <div className="rb-state__actions">
        {hasFilters ? (
          <button className="rb-state__action" type="button" onClick={onClear}>
            <HiX aria-hidden="true" size={17} />
            <span>{localize(language, 'Clear Filters', 'ফিল্টার মুছুন')}</span>
          </button>
        ) : null}
        {!hasFilters && isTeacher ? (
          <button className="rb-state__action" type="button" onClick={onUpload}>
            <HiPlus aria-hidden="true" size={17} />
            <span>{localize(language, 'Upload the First Book', 'প্রথম বইটি আপলোড করুন')}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function OwnerActions({ book, language, onEdit, onDelete }) {
  return (
    <div className="rb-book-card__owner-actions">
      <button
        className="rb-book-card__icon-btn rb-book-card__icon-btn--edit"
        type="button"
        aria-label={localize(language, `Edit ${book.title}`, `${book.title} সম্পাদনা করুন`)}
        title={localize(language, 'Edit Book', 'বই সম্পাদনা করুন')}
        onClick={() => onEdit(book._id)}
      >
        <HiPencilAlt aria-hidden="true" size={17} />
      </button>
      <button
        className="rb-book-card__icon-btn rb-book-card__icon-btn--delete"
        type="button"
        aria-label={localize(language, `Delete ${book.title}`, `${book.title} মুছে ফেলুন`)}
        title={localize(language, 'Delete Book', 'বই মুছে ফেলুন')}
        onClick={() => onDelete(book)}
      >
        <HiTrash aria-hidden="true" size={17} />
      </button>
    </div>
  );
}

function ChapterList({ chapters, loading, language, t, onOpenChapter }) {
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(language === 'en' ? 'en-US' : 'bn-BD'),
    [language]
  );

  if (loading) {
    return (
      <p className="rb-chapters-message" role="status" aria-live="polite">
        {localize(language, 'Loading chapters…', 'অধ্যায় লোড হচ্ছে…')}
      </p>
    );
  }

  if (!chapters || chapters.length === 0) {
    return (
      <p className="rb-chapters-message">
        {localize(language, 'No chapters are available yet.', 'এখনও কোনো অধ্যায় নেই।')}
      </p>
    );
  }

  return (
    <ol className="rb-chapter-list">
      {chapters.map((chapter, index) => {
        const chapterTitle = chapter.title || localize(language, 'Untitled Chapter', 'শিরোনামহীন অধ্যায়');
        const chapterNumber = Number.isFinite(chapter.order) ? chapter.order + 1 : index + 1;

        return (
          <li className="rb-chapter-item" key={chapter._id}>
            <span className="rb-chapter-num">{numberFormatter.format(chapterNumber)}</span>
            <span className="rb-chapter-title">{chapterTitle}</span>
            <button
              className="rb-chapter-open-btn"
              type="button"
              aria-label={localize(language, `Open ${chapterTitle}`, `${chapterTitle} খুলুন`)}
              onClick={() => onOpenChapter(chapter._id)}
            >
              <span>{t('rb.open_reader')}</span>
              <HiArrowRight aria-hidden="true" size={14} />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function BookCard({
  book,
  language,
  owner,
  expanded,
  chapters,
  loadingChapters,
  t,
  onExpand,
  onOpenChapter,
  onEdit,
  onDelete
}) {
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(language === 'en' ? 'en-US' : 'bn-BD'),
    [language]
  );
  const safeTitle = book.title || localize(language, 'Untitled Book', 'শিরোনামহীন বই');
  const chapterCount = book.chapterCount || book.chapters?.length || 0;
  const categoryTone = book.category === 'Admission' ? 'admission' : 'academic';
  const categoryLabel = getOptionLabel(CATEGORY_OPTIONS, book.category, language);
  const groupLabel = getOptionLabel(GROUP_OPTIONS, book.group, language);
  const paperLabel = getOptionLabel(PAPER_OPTIONS, book.paper, language);
  const uploaderName = typeof book.uploadedBy === 'object' ? book.uploadedBy?.name : '';
  const uploaderAvatar = typeof book.uploadedBy === 'object' ? book.uploadedBy?.avatar : '';
  const chaptersId = `rb-book-${book._id}-chapters`;
  const titleId = `rb-book-${book._id}-title`;

  return (
    <article className={`rb-book-card rb-book-card--${categoryTone} ${expanded ? 'rb-book-card--expanded' : ''}`}>
      <div className="rb-book-card__cover">
        <span className="rb-book-card__category">{categoryLabel}</span>
        {owner ? (
          <span className="rb-book-card__owner-badge">
            {localize(language, 'Your Upload', 'আপনার আপলোড')}
          </span>
        ) : null}
        <div className="rb-book-card__book" aria-hidden="true">
          <span className="rb-book-card__book-mark" />
          <HiLibrary size={30} />
          <span>{book.subject || categoryLabel}</span>
        </div>
        <div className="rb-book-card__page-lines" aria-hidden="true" />
      </div>

      <div className="rb-book-card__body">
        <div className="rb-book-card__taxonomy">
          {book.subject ? <span>{book.subject}</span> : null}
          {book.paper && book.paper !== 'N/A' ? <span>{paperLabel}</span> : null}
          {book.group ? <span>{groupLabel}</span> : null}
        </div>

        <h3 className="rb-book-card__title" id={titleId}>{safeTitle}</h3>
        {book.description ? (
          <p className="rb-book-card__description">{book.description}</p>
        ) : (
          <p className="rb-book-card__description rb-book-card__description--muted">
            {localize(language, 'Open the chapter list to start reading.', 'পড়া শুরু করতে অধ্যায়ের তালিকা খুলুন।')}
          </p>
        )}

        <div className="rb-book-card__details">
          <div className="rb-book-card__stats">
            <HiDocumentText aria-hidden="true" size={15} />
            <span>{numberFormatter.format(chapterCount)} {t('rb.chapters')}</span>
          </div>
          {book.knowledgeStatus && book.knowledgeStatus !== 'completed' ? (
            <span className={`rb-book-card__status rb-book-card__status--${book.knowledgeStatus}`}>
              {getStatusLabel(book.knowledgeStatus, language)}
            </span>
          ) : null}
          {uploaderName ? (
            <div className="rb-book-card__author" title={uploaderName}>
              {uploaderAvatar ? (
                <img
                  className="rb-book-card__avatar"
                  src={uploaderAvatar}
                  alt=""
                  width="24"
                  height="24"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="rb-book-card__avatar-placeholder" aria-hidden="true">
                  {uploaderName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="rb-book-card__author-name">{uploaderName}</span>
            </div>
          ) : null}
        </div>

        <div className="rb-book-card__actions">
          <button
            className="rb-book-card__primary-action"
            type="button"
            aria-expanded={expanded}
            aria-controls={chaptersId}
            onClick={onExpand}
          >
            <span>
              {expanded
                ? localize(language, 'Hide Chapters', 'অধ্যায় লুকান')
                : localize(language, 'View Chapters', 'অধ্যায় দেখুন')}
            </span>
            <span className={`rb-book-card__action-icon ${expanded ? 'rb-book-card__action-icon--expanded' : ''}`}>
              <HiArrowRight aria-hidden="true" size={16} />
            </span>
          </button>
          {owner ? (
            <OwnerActions
              book={{ ...book, title: safeTitle }}
              language={language}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ) : null}
        </div>

        {expanded ? (
          <div
            className="rb-book-card__chapters"
            id={chaptersId}
            role="region"
            aria-labelledby={titleId}
          >
            <div className="rb-book-card__chapters-heading">
              <span>{localize(language, 'Chapter List', 'অধ্যায়ের তালিকা')}</span>
              <HiBookOpen aria-hidden="true" size={17} />
            </div>
            <ChapterList
              chapters={chapters}
              loading={loadingChapters}
              language={language}
              t={t}
              onOpenChapter={onOpenChapter}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function BookCatalog({
  books,
  language,
  loading,
  loadError,
  isSearchStale,
  hasFilters,
  isTeacher,
  expandedBookId,
  chaptersByBook,
  loadingChapters,
  t,
  isOwner,
  onRetry,
  onClear,
  onUpload,
  onExpand,
  onOpenChapter,
  onEdit,
  onDelete
}) {
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(language === 'en' ? 'en-US' : 'bn-BD'),
    [language]
  );

  return (
    <section
      className={`rb-catalog ${isSearchStale ? 'rb-catalog--updating' : ''}`}
      id="library-catalog"
      aria-labelledby="rb-catalog-title"
      aria-busy={loading || isSearchStale}
    >
      <div className="rb-catalog__heading">
        <div>
          <span className="rb-section-kicker">{localize(language, 'Collection', 'সংগ্রহ')}</span>
          <h2 id="rb-catalog-title">{localize(language, 'Browse the Shelf', 'বইয়ের তাক')}</h2>
        </div>
        {!loading && !loadError ? (
          <p className="rb-catalog__count" aria-live="polite">
            <strong>{numberFormatter.format(books.length)}</strong>
            <span>{localize(language, books.length === 1 ? 'book found' : 'books found', 'টি বই পাওয়া গেছে')}</span>
          </p>
        ) : null}
      </div>

      {loading ? (
        <LibraryLoading language={language} />
      ) : loadError ? (
        <LibraryError language={language} onRetry={onRetry} />
      ) : books.length === 0 ? (
        <LibraryEmpty
          language={language}
          hasFilters={hasFilters}
          isTeacher={isTeacher}
          onClear={onClear}
          onUpload={onUpload}
        />
      ) : (
        <div className="rb-grid">
          {books.map((book) => (
            <BookCard
              key={book._id}
              book={book}
              language={language}
              owner={isOwner(book)}
              expanded={expandedBookId === book._id}
              chapters={chaptersByBook[book._id]}
              loadingChapters={Boolean(loadingChapters[book._id])}
              t={t}
              onExpand={() => onExpand(book._id)}
              onOpenChapter={(chapterId) => onOpenChapter(book._id, chapterId)}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ConfirmDeleteDialog({ book, language, deleting, onClose, onConfirm }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
    };
  }, []);

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget && !deleting) onClose();
  };

  return (
    <dialog
      className="rb-delete-dialog"
      ref={dialogRef}
      aria-labelledby="rb-delete-dialog-title"
      aria-describedby="rb-delete-dialog-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!deleting) onClose();
      }}
      onClick={handleBackdropClick}
    >
      <div className="rb-delete-dialog__card">
        <div className="rb-delete-dialog__icon">
          <HiTrash aria-hidden="true" size={26} />
        </div>
        <span className="rb-section-kicker">{localize(language, 'Permanent Action', 'স্থায়ী পদক্ষেপ')}</span>
        <h2 id="rb-delete-dialog-title">
          {localize(language, 'Delete This Book?', 'এই বইটি মুছে ফেলবেন?')}
        </h2>
        <p id="rb-delete-dialog-description">
          {localize(
            language,
            `“${book.title}” and all of its chapters will be permanently deleted.`,
            `“${book.title}” এবং এর সব অধ্যায় স্থায়ীভাবে মুছে যাবে।`
          )}
        </p>
        <div className="rb-delete-dialog__actions">
          <button className="rb-delete-dialog__cancel" type="button" onClick={onClose} disabled={deleting}>
            {localize(language, 'Keep Book', 'বইটি রাখুন')}
          </button>
          <button className="rb-delete-dialog__confirm" type="button" onClick={onConfirm} disabled={deleting}>
            <HiTrash aria-hidden="true" size={17} />
            <span>{deleting ? localize(language, 'Deleting…', 'মুছে ফেলা হচ্ছে…') : localize(language, 'Delete Book', 'বই মুছুন')}</span>
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default function ReadingBooks() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, language } = useLanguage();
  const [user, setUser] = useState(getCachedUser);
  const [taxonomy, setTaxonomy] = useState({ subjects: [] });
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const [expandedBookId, setExpandedBookId] = useState(null);
  const [chaptersByBook, setChaptersByBook] = useState({});
  const [loadingChapters, setLoadingChapters] = useState({});
  const [bookToDelete, setBookToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const category = searchParams.get('category') || '';
  const group = searchParams.get('group') || '';
  const subject = searchParams.get('subject') || '';
  const paper = searchParams.get('paper') || '';
  const searchQuery = searchParams.get('q') || '';
  const myUploadsOnly = searchParams.get('scope') === 'mine';
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const refreshAt = location.state?.refreshAt;
  const filters = useMemo(
    () => ({ category, group, subject, paper }),
    [category, group, subject, paper]
  );

  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) {
      window.location.href = '/';
      return undefined;
    }

    const controller = new AbortController();
    const fetchUser = async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        });
        if (response.status === 401) {
          localStorage.removeItem('topkorbo_token');
          window.location.href = '/';
          return;
        }
        const data = await response.json();
        if (data.success && data.data) {
          const nextUser = {
            id: data.data._id,
            name: data.data.name,
            avatar: data.data.avatar || '',
            email: data.data.email,
            role: data.data.role
          };
          setUser(nextUser);
          localStorage.setItem('topkorbo_id', nextUser.id);
          localStorage.setItem('topkorbo_name', nextUser.name);
          localStorage.setItem('topkorbo_avatar', nextUser.avatar);
          localStorage.setItem('topkorbo_email', nextUser.email);
          localStorage.setItem('topkorbo_role', nextUser.role);
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error fetching user data:', error);
        }
      }
    };

    fetchUser();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fetchTaxonomy = async () => {
      try {
        const token = localStorage.getItem('topkorbo_token');
        const response = await fetch(`${API_BASE}/books/taxonomy`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        });
        const data = await response.json();
        if (data.success && data.data) setTaxonomy(data.data);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error fetching taxonomy:', error);
        }
      }
    };

    fetchTaxonomy();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fetchBooks = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const token = localStorage.getItem('topkorbo_token');
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        if (group) params.set('group', group);
        if (subject) params.set('subject', subject);
        if (paper) params.set('paper', paper);
        if (myUploadsOnly && user.role === 'teacher' && user.id) {
          params.set('uploadedBy', user.id);
        }

        const query = params.toString();
        const response = await fetch(`${API_BASE}/books${query ? `?${query}` : ''}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`Books request failed with ${response.status}`);

        const data = await response.json();
        if (data.success && data.data) {
          setBooks(data.data.books || []);
        } else {
          throw new Error(data.message || 'Books response was not successful');
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error fetching books:', error);
          setBooks([]);
          setLoadError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchBooks();
    return () => controller.abort();
  }, [
    category,
    group,
    subject,
    paper,
    myUploadsOnly,
    user.role,
    user.id,
    refreshAt,
    retryVersion
  ]);

  const availableSubjects = useMemo(() => {
    const baseList = filters.group && SUBJECT_OPTIONS_BY_GROUP[filters.group]
      ? SUBJECT_OPTIONS_BY_GROUP[filters.group]
      : Object.values(SUBJECT_OPTIONS_BY_GROUP).flat().reduce((subjects, item) => {
          if (!subjects.some((subjectOption) => subjectOption.id === item.id)) subjects.push(item);
          return subjects;
        }, []);

    const seenIds = new Set(baseList.map((item) => item.id.toLocaleLowerCase()));
    const legacySubjects = (taxonomy.subjects || [])
      .filter((item) => item && !seenIds.has(item.toLocaleLowerCase()))
      .map((item) => ({ id: item, labelEn: item, labelBn: item }));

    return [...baseList, ...legacySubjects];
  }, [filters.group, taxonomy.subjects]);

  const filteredBooks = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLocaleLowerCase();
    let list = books;

    if (myUploadsOnly && user.role === 'teacher') {
      list = list.filter((book) => {
        if (!book.uploadedBy) return false;
        const uploaderEmail = typeof book.uploadedBy === 'object' ? book.uploadedBy.email : '';
        const uploaderId = typeof book.uploadedBy === 'object' ? book.uploadedBy._id : book.uploadedBy;
        const matchesEmail = uploaderEmail && user.email
          ? uploaderEmail.toLocaleLowerCase() === user.email.toLocaleLowerCase()
          : false;
        const matchesId = uploaderId && user.id ? String(uploaderId) === String(user.id) : false;
        return matchesEmail || matchesId;
      });
    }

    if (!normalizedQuery) return list;
    return list.filter((book) => (
      String(book.title || '').toLocaleLowerCase().includes(normalizedQuery)
      || String(book.description || '').toLocaleLowerCase().includes(normalizedQuery)
      || String(book.subject || '').toLocaleLowerCase().includes(normalizedQuery)
    ));
  }, [books, deferredSearchQuery, myUploadsOnly, user.role, user.email, user.id]);

  const activeFilterCount = FILTER_KEYS.reduce(
    (count, key) => count + (filters[key] ? 1 : 0),
    searchQuery ? 1 : 0
  ) + (myUploadsOnly ? 1 : 0);
  const hasFilters = activeFilterCount > 0;

  const updateSearchParams = useCallback((updates) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (value) nextParams.set(key, value);
        else nextParams.delete(key);
      });
      return nextParams;
    }, { replace: true });
  }, [setSearchParams]);

  const handleFilterChange = useCallback((key, value) => {
    const updates = { [key]: value };
    if (key === 'group' && filters.subject) {
      const validSubjects = SUBJECT_OPTIONS_BY_GROUP[value] || [];
      if (value && !validSubjects.some((item) => item.id === filters.subject)) {
        updates.subject = '';
      }
    }
    updateSearchParams(updates);
  }, [filters.subject, updateSearchParams]);

  const handleClearFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
    setExpandedBookId(null);
  }, [setSearchParams]);

  const handleExpandBook = useCallback(async (bookId) => {
    if (expandedBookId === bookId) {
      setExpandedBookId(null);
      return;
    }

    setExpandedBookId(bookId);
    if (chaptersByBook[bookId]) return;
    setLoadingChapters((current) => ({ ...current, [bookId]: true }));
    try {
      const token = localStorage.getItem('topkorbo_token');
      const response = await fetch(`${API_BASE}/books/${bookId}/chapters`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(`Chapters request failed with ${response.status}`);
      const data = await response.json();
      if (data.success && data.data) {
        setChaptersByBook((current) => ({
          ...current,
          [bookId]: data.data.chapters || []
        }));
      }
    } catch (error) {
      console.error('Error fetching chapters:', error);
      toast.error(localize(language, 'Could not load the chapters. Try again.', 'অধ্যায় লোড হয়নি। আবার চেষ্টা করুন।'));
    } finally {
      setLoadingChapters((current) => ({ ...current, [bookId]: false }));
    }
  }, [chaptersByBook, expandedBookId, language]);

  const handleUploadClick = useCallback(() => {
    if (user.role !== 'teacher') {
      toast.error(localize(
        language,
        'Only teachers can upload books. Become a teacher first.',
        'শুধুমাত্র শিক্ষকরা বই আপলোড করতে পারবেন।'
      ));
      return;
    }
    navigate('/reading-books/upload');
  }, [language, navigate, user.role]);

  const isOwner = useCallback((book) => {
    if (user.role !== 'teacher' || !book.uploadedBy) return false;
    const uploaderEmail = typeof book.uploadedBy === 'object' ? book.uploadedBy.email : '';
    const uploaderId = typeof book.uploadedBy === 'object' ? book.uploadedBy._id : book.uploadedBy;
    return Boolean(
      (uploaderEmail && uploaderEmail === user.email)
      || (uploaderId && String(uploaderId) === String(user.id))
    );
  }, [user.email, user.id, user.role]);

  const closeDeleteDialog = useCallback(() => {
    if (!deleting) setBookToDelete(null);
  }, [deleting]);

  const confirmDeleteBook = useCallback(async () => {
    if (!bookToDelete?._id || deleting) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem('topkorbo_token');
      const response = await fetch(`${API_BASE}/books/${bookToDelete._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Delete request failed');
      }
      toast.success(localize(language, 'Book deleted successfully', 'বইটি সফলভাবে মুছে ফেলা হয়েছে'));
      setBooks((current) => current.filter((book) => book._id !== bookToDelete._id));
      setBookToDelete(null);
    } catch (error) {
      console.error('Error deleting book:', error);
      toast.error(localize(language, 'Could not delete the book. Try again.', 'বইটি মুছে ফেলা যায়নি। আবার চেষ্টা করুন।'));
    } finally {
      setDeleting(false);
    }
  }, [bookToDelete, deleting, language]);

  return (
    <div className="dashboard-container">
      <a className="rb-skip-link" href="#library-main-content">
        {localize(language, 'Skip to Library Content', 'লাইব্রেরির মূল অংশে যান')}
      </a>
      <Sidebar activeTab="reading-books" user={user} />
      <main className="dashboard-main" id="library-main-content" tabIndex="-1">
        <div className="rb-workspace">
          <div className="rb-page">
            <LibraryHero
              bookCount={books.length}
              language={language}
              role={user.role}
              onUpload={handleUploadClick}
            />
            <LibraryFilters
              filters={filters}
              searchQuery={searchQuery}
              language={language}
              availableSubjects={availableSubjects}
              activeFilterCount={activeFilterCount}
              myUploadsOnly={myUploadsOnly}
              isTeacher={user.role === 'teacher'}
              onFilterChange={handleFilterChange}
              onSearchChange={(value) => updateSearchParams({ q: value })}
              onClear={handleClearFilters}
              onToggleMine={() => updateSearchParams({ scope: myUploadsOnly ? '' : 'mine' })}
            />
            <BookCatalog
              books={filteredBooks}
              language={language}
              loading={loading}
              loadError={loadError}
              isSearchStale={searchQuery !== deferredSearchQuery}
              hasFilters={hasFilters}
              isTeacher={user.role === 'teacher'}
              expandedBookId={expandedBookId}
              chaptersByBook={chaptersByBook}
              loadingChapters={loadingChapters}
              t={t}
              isOwner={isOwner}
              onRetry={() => setRetryVersion((version) => version + 1)}
              onClear={handleClearFilters}
              onUpload={handleUploadClick}
              onExpand={handleExpandBook}
              onOpenChapter={(bookId, chapterId) => navigate(`/reading-books/${bookId}/${chapterId}?page=1`)}
              onEdit={(bookId) => navigate(`/reading-books/upload?bookId=${bookId}`)}
              onDelete={setBookToDelete}
            />
          </div>
        </div>
      </main>

      {bookToDelete ? (
        <ConfirmDeleteDialog
          book={bookToDelete}
          language={language}
          deleting={deleting}
          onClose={closeDeleteDialog}
          onConfirm={confirmDeleteBook}
        />
      ) : null}
    </div>
  );
}
