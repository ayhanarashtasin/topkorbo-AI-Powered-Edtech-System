import { useEffect } from 'react';
import { HiX, HiTrash, HiSparkles, HiOutlineDocumentText } from 'react-icons/hi';
import './HighlightSidebar.css';

export default function HighlightSidebar({ 
  isOpen, 
  onClose, 
  highlights = [], 
  onHighlightClick,
  onDeleteHighlight,
  onAskHighlightAI
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        className="rb-highlight-sidebar-backdrop"
        onClick={onClose}
        aria-label="Close highlights sidebar"
        tabIndex={-1}
      />
      <aside className="rb-highlight-sidebar" aria-label="Highlights & Notes">
        <div className="rb-highlight-sidebar-header">
          <div className="rb-highlight-sidebar-title-group">
            <HiOutlineDocumentText size={20} className="rb-highlight-sidebar-icon" aria-hidden="true" />
            <div>
              <h3>Highlights & Notes</h3>
              <p>{highlights.length} {highlights.length === 1 ? 'item' : 'items'} in this chapter</p>
            </div>
          </div>
          <button
            type="button"
            className="rb-highlight-sidebar-close-btn"
            onClick={onClose}
            aria-label="Close highlights sidebar"
          >
            <HiX size={18} aria-hidden="true" />
          </button>
        </div>
        
        <div className="rb-highlight-sidebar-content">
          {highlights.length === 0 ? (
            <div className="rb-no-highlights">
              <HiOutlineDocumentText size={36} className="rb-no-highlights-icon" aria-hidden="true" />
              <p>No highlights yet</p>
              <span>Use the Highlighter tool or select text in the PDF to create highlights and attach notes.</span>
            </div>
          ) : (
            highlights.map((h) => (
              <div key={h._id} className="rb-sidebar-highlight-item">
                <div 
                  className="rb-highlight-text"
                  style={{ borderLeftColor: h.color || '#FFF176' }}
                  onClick={() => onHighlightClick?.(h)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onHighlightClick?.(h);
                    }
                  }}
                >
                  <p className="rb-highlight-quote">"{h.text}"</p>
                  {h.note && (
                    <div className="rb-highlight-note-card">
                      <span className="rb-highlight-note-tag">Note</span>
                      <p className="rb-highlight-note">{h.note}</p>
                    </div>
                  )}
                  <div className="rb-highlight-footer">
                    <span className="rb-highlight-meta">Page {h.pageNumber}</span>
                    {onAskHighlightAI && (
                      <div className="rb-highlight-actions">
                        <button
                          type="button"
                          className="rb-highlight-ai-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAskHighlightAI(h, 'summary');
                          }}
                          title="Summarize highlighted passage"
                        >
                          <HiSparkles size={12} aria-hidden="true" />
                          <span>Summarize</span>
                        </button>
                        <button
                          type="button"
                          className="rb-highlight-ai-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAskHighlightAI(h, 'notes');
                          }}
                          title="Generate study notes from passage"
                        >
                          <span>Notes</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <button 
                  type="button"
                  className="rb-highlight-delete"
                  onClick={() => onDeleteHighlight?.(h._id)}
                  title="Delete Highlight"
                  aria-label="Delete Highlight"
                >
                  <HiTrash size={16} aria-hidden="true" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
