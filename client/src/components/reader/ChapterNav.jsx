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
  hasNext
}) {
  const { t } = useLanguage();

  return (
    <>
      {/* Click-to-dismiss backdrop shown only on mobile when the drawer is open. */}
      <div
        className={`rb-chapnav__backdrop ${isOpen ? 'rb-chapnav__backdrop--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`rb-chapnav ${isOpen ? 'rb-chapnav--open' : ''}`}
        aria-label={t('rb.reader.chapters')}
      >
        <header className="rb-chapnav__header">
          <div className="rb-chapnav__book">
            <HiBookOpen size={18} />
            <div className="rb-chapnav__book-meta">
              <h3 className="rb-chapnav__book-title">{book?.title || ''}</h3>
              {book?.subject && (
                <span className="rb-chapnav__book-sub">
                  {book.subject}
                  {book.paper && book.paper !== 'N/A' ? ` · ${book.paper}` : ''}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="rb-chapnav__close"
            onClick={onClose}
            aria-label={t('rb.reader.menu')}
          >
            <HiX size={18} />
          </button>
        </header>

        <div className="rb-chapnav__chapters">
          <h4 className="rb-chapnav__section-title">
            {t('rb.reader.chapters')}
          </h4>
          {(!chapters || chapters.length === 0) ? (
            <p className="rb-chapnav__empty">
              {t('rb.reader.no_chapters')}
            </p>
          ) : (
            <ul className="rb-chapnav__list">
              {chapters.map((c, idx) => (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => onSelectChapter(c._id)}
                    className={`rb-chapnav__item ${
                      c._id === activeChapterId ? 'rb-chapnav__item--active' : ''
                    }`}
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
                <HiChevronLeft size={16} />
                <span>{t('rb.reader.prev')}</span>
              </button>
              <button
                type="button"
                className="rb-chapnav__nav-btn"
                onClick={onNextChapter}
                disabled={!hasNext}
              >
                <span>{t('rb.reader.next')}</span>
                <HiChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="rb-chapnav__bookmarks">
          <h4 className="rb-chapnav__section-title">
            {t('rb.reader.bookmarks')}
          </h4>
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
                    <HiDocumentText size={14} />
                    <span>
                      {t('rb.reader.page_label').replace('{n}', bm.pageNumber)}
                    </span>
                  </button>
                  {onClearBookmark && (
                    <button
                      type="button"
                      className="rb-chapnav__bookmark-remove"
                      onClick={() => onClearBookmark(bm)}
                      aria-label={t('rb.upload.remove')}
                    >
                      <HiX size={12} />
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
