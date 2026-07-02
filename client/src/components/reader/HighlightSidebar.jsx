import { HiX, HiTrash } from 'react-icons/hi';
import './HighlightSidebar.css';

export default function HighlightSidebar({ 
  isOpen, 
  onClose, 
  highlights, 
  onHighlightClick,
  onDeleteHighlight,
  onAskHighlightAI
}) {
  if (!isOpen) return null;

  return (
    <div className="rb-highlight-sidebar">
      <div className="rb-highlight-sidebar-header">
        <h3>Highlights & Notes</h3>
        <button onClick={onClose}><HiX /></button>
      </div>
      
      <div className="rb-highlight-sidebar-content">
        {highlights.length === 0 ? (
          <p className="rb-no-highlights">No highlights yet.</p>
        ) : (
          highlights.map(h => (
            <div key={h._id} className="rb-sidebar-highlight-item">
              <div 
                className="rb-highlight-text"
                style={{ borderLeftColor: h.color }}
                onClick={() => onHighlightClick(h)}
              >
                <p>"{h.text}"</p>
                {h.note && <p className="rb-highlight-note">{h.note}</p>}
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
                    >
                      Summarize
                    </button>
                    <button
                      type="button"
                      className="rb-highlight-ai-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAskHighlightAI(h, 'notes');
                      }}
                    >
                      Notes
                    </button>
                  </div>
                )}
              </div>
              <button 
                className="rb-highlight-delete"
                onClick={() => onDeleteHighlight(h._id)}
                title="Delete Highlight"
              >
                <HiTrash />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
