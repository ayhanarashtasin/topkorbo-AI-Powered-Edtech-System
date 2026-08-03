import { Link } from 'react-router-dom';
import {
  HiArrowLeft,
  HiBookOpen,
  HiMenu,
  HiOutlineDocumentText
} from 'react-icons/hi';

function ReaderHeaderRoot({ children }) {
  return <header className="rb-reader-header">{children}</header>;
}

function ReaderHeaderNavigation({ isOpen, onToggle, backLabel }) {
  const navigationLabel = isOpen ? 'Hide Chapters' : 'Show Chapters';

  return (
    <nav className="rb-reader-header__navigation" aria-label="Reader Navigation">
      <button
        type="button"
        className="rb-reader-header__nav-button"
        onClick={onToggle}
        aria-label={navigationLabel}
        aria-expanded={isOpen}
        aria-controls="reader-chapter-navigation"
      >
        <HiMenu size={18} aria-hidden="true" />
        <span>{navigationLabel}</span>
      </button>
      <Link className="rb-reader-header__back-link" to="/reading-books">
        <HiArrowLeft size={18} aria-hidden="true" />
        <span>{backLabel}</span>
      </Link>
    </nav>
  );
}

function ReaderHeaderContext({ bookTitle, chapterTitle, bookMeta }) {
  return (
    <div className="rb-reader-header__context">
      <span className="rb-reader-header__eyebrow">
        <HiBookOpen size={15} aria-hidden="true" />
        Reading Room
      </span>
      <h1>{chapterTitle || 'Untitled Chapter'}</h1>
      <p title={bookTitle || undefined}>
        <span>{bookTitle || 'Reading Book'}</span>
        {bookMeta ? <span aria-hidden="true">/</span> : null}
        {bookMeta ? <span>{bookMeta}</span> : null}
      </p>
    </div>
  );
}

function ReaderHeaderProgress({ pageNumber, pageCount, progress }) {
  const hasPageCount = Number.isFinite(pageCount) && pageCount > 0;
  const safeProgress = Math.min(100, Math.max(0, Number(progress) || 0));
  const pageLabel = hasPageCount ? `${pageNumber} of ${pageCount}` : `${pageNumber}`;

  return (
    <div
      className="rb-reader-header__progress"
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeProgress}
      aria-valuetext={`Page ${pageLabel}, ${safeProgress}% complete`}
    >
      <div className="rb-reader-header__progress-copy">
        <span>Reading Progress</span>
        <strong>{safeProgress}%</strong>
      </div>
      <div className="rb-reader-header__page-count">
        <HiOutlineDocumentText size={14} />
        <div className="rb-reader-header__page-count-text">
          <span>Page</span>
          <strong>{pageLabel}</strong>
        </div>
      </div>
      <div className="rb-reader-header__progress-track" aria-hidden="true">
        <span style={{ width: `${safeProgress}%` }} />
      </div>
    </div>
  );
}

const ReaderHeader = Object.assign(ReaderHeaderRoot, {
  Navigation: ReaderHeaderNavigation,
  Context: ReaderHeaderContext,
  Progress: ReaderHeaderProgress
});

export default ReaderHeader;
