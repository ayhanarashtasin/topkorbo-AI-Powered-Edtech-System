import React from 'react';
import { HiAnnotation } from 'react-icons/hi';
import './HighlightLayer.css';

/**
 * Renders highlights on top of the PDF.
 * Expects an array of highlight objects. Each highlight has `rects` (array of { x, y, width, height } in [0..1] space).
 */
export default function HighlightLayer({ highlights, activeTool, onHighlightClick }) {
  if (!highlights || highlights.length === 0) return null;

  return (
    <div className={`rb-highlight-layer ${activeTool === 'eraser' ? 'rb-highlight-layer--eraser' : ''}`}>
      {highlights.map((highlight) => (
        <div key={highlight._id} className="rb-highlight-group">
          {highlight.rects && highlight.rects.map((rect, i) => (
            <div
              key={`${highlight._id}-${i}`}
              className="rb-highlight-rect"
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.width * 100}%`,
                height: `${rect.height * 100}%`,
                backgroundColor: highlight.color || '#FFEB3B',
              }}
              title={highlight.note || undefined}
              onPointerDown={(e) => {
                if (activeTool === 'eraser' || activeTool === 'select' || activeTool === 'highlighter') {
                  e.stopPropagation();
                  onHighlightClick && onHighlightClick(highlight, e);
                }
              }}
            />
          ))}
          {highlight.note && highlight.boundingRect && (
            <div
              className="rb-highlight-note-icon"
              style={{
                left: `${(highlight.boundingRect.x + highlight.boundingRect.width) * 100}%`,
                top: `${highlight.boundingRect.y * 100}%`,
                color: highlight.color || '#FFEB3B',
              }}
              title={highlight.note}
              onPointerDown={(e) => {
                if (activeTool === 'eraser' || activeTool === 'select' || activeTool === 'highlighter') {
                  e.stopPropagation();
                  onHighlightClick && onHighlightClick(highlight, e);
                }
              }}
            >
              <HiAnnotation />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
