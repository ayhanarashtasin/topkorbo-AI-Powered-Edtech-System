import { useEffect, useMemo } from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import {
  HiX,
  HiBookOpen,
  HiChevronLeft,
  HiChevronRight,
  HiDocumentText
} from 'react-icons/hi';
import './ChapterNav.css';

export default function ChapterNav({
  book,
  chapters,
  activeChapterId,
  onSelectChapter,
  isOpen,
  onClose,
  bookmarks,
  onSelectBookmark,
  onClearBookmark,
  onPrevChapter,
  onNextChapter,
  hasPrev,
  hasNext,
  onAskBookAI,
  onOpenMindMap,
  canReadingAI = false,
  knowledgeStatus = 'pending'
}) {
  const { t } = useLanguage();

  const sortedChapters = useMemo(() => {
    return [...(chapters || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [chapters]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      <button
        type="button"
        className={`rb-chapnav__backdrop ${isOpen ? 'rb-chapnav__backdrop--visible' : ''}`}
        onClick={onClose}
        tabIndex={-1}
        aria-hidden="true"
      />

      <aside
        id="reader-chapter-navigation"
        className={`rb-chapnav ${isOpen ? 'rb-chapnav--open' : ''}`}
        aria-label={t('rb.reader.chapters')}
        aria-hidden={!isOpen}
      >
        <header className="rb-chapnav__header">
          <div className="rb-chapnav__book">
            <span className="rb-chapnav__book-icon" aria-hidden="true">
              <HiBookOpen size={20} />
            </span>
            <div className="rb-chapnav__book-meta">
              <span className="rb-chapnav__eyebrow">Current Book</span>
              <p className="rb-chapnav__book-title">{book?.title || 'Reading Book'}</p>
              {book?.subject && (
                <span className="rb-chapnav__book-sub">
                  {book.subject}
                  {book.paper && book.paper !== 'N/A' ? ` / ${book.paper}` : ''}
                </span>
              )}
              <span className="rb-chapnav__status rb-chapnav__status--ready">
                Ready to Study
              </span>
            </div>
          </div>
          <button
            type="button"
            className="rb-chapnav__close"
            onClick={onClose}
            aria-label="Close Chapter Navigation"
          >
            <HiX size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="rb-chapnav__chapters">
          <div className="rb-chapnav__section-head">
            <p className="rb-chapnav__section-title">{t('rb.reader.chapters')}</p>
            <div className="rb-chapnav__section-actions">
              <button
                type="button"
                className="rb-chapnav__book-ai-btn"
                onClick={onAskBookAI}
              >
                <span>Ask Book</span>
              </button>
              <button
                type="button"
                className="rb-chapnav__book-ai-btn"
                onClick={onOpenMindMap}
                title={canReadingAI ? `Mind map: ${knowledgeStatus}` : 'Mind map is a Pro+ feature'}
              >
                <span>Mind Map</span>
              </button>
            </div>
          </div>

          {sortedChapters.length === 0 ? (
            <p className="rb-chapnav__empty">{t('rb.reader.no_chapters')}</p>
          ) : (
            <ul className="rb-chapnav__list">
              {sortedChapters.map((c, idx) => (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => onSelectChapter(c._id)}
                    className={`rb-chapnav__item ${c._id === activeChapterId ? 'rb-chapnav__item--active' : ''}`}
                    aria-current={c._id === activeChapterId ? 'page' : undefined}
                  >
                    <span className="rb-chapnav__num">{idx + 1}</span>
                    <span className="rb-chapnav__title">{c.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {(hasPrev || hasNext) && (
            <div className="rb-chapnav__nav-row">
              <button
                type="button"
                className="rb-chapnav__nav-btn"
                onClick={onPrevChapter}
                disabled={!hasPrev}
              >
                <HiChevronLeft size={16} aria-hidden="true" />
                <span>{t('rb.reader.prev')}</span>
              </button>
              <button
                type="button"
                className="rb-chapnav__nav-btn"
                onClick={onNextChapter}
                disabled={!hasNext}
              >
                <span>{t('rb.reader.next')}</span>
                <HiChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        <div className="rb-chapnav__bookmarks">
          <p className="rb-chapnav__section-title">{t('rb.reader.bookmarks')}</p>
          {(!bookmarks || bookmarks.length === 0) ? (
            <p className="rb-chapnav__empty">{t('rb.reader.no_bookmarks')}</p>
          ) : (
            <ul className="rb-chapnav__bookmark-list">
              {bookmarks.map((bm) => (
                <li key={bm._id} className="rb-chapnav__bookmark">
                  <button
                    type="button"
                    className="rb-chapnav__bookmark-btn"
                    onClick={() => onSelectBookmark(bm)}
                  >
                    <HiDocumentText size={14} aria-hidden="true" />
                    <span>{t('rb.reader.page_label').replace('{n}', bm.pageNumber)}</span>
                  </button>
                  {onClearBookmark && (
                    <button
                      type="button"
                      className="rb-chapnav__bookmark-remove"
                      onClick={() => onClearBookmark(bm)}
                      aria-label={t('rb.upload.remove')}
                    >
                      <HiX size={12} aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
