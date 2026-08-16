import { useState } from 'react';
import { HiOutlinePencilAlt, HiX } from 'react-icons/hi';
import './HighlightPopup.css';

const COLORS = [
  { label: 'Yellow', value: '#FFF176' },
  { label: 'Green', value: '#A5D6A7' },
  { label: 'Blue', value: '#90CAF9' },
  { label: 'Pink', value: '#F48FB1' },
];

export default function HighlightPopup({ position, onHighlight, onSummarize }) {
  const [note, setNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  if (!position) return null;

  return (
    <div
      className="rb-highlight-popup"
      style={{ left: position.x, top: position.y }}
    >
      <div className="rb-popup-row">
        <div className="rb-colors">
          {COLORS.map((color) => (
            <button
              type="button"
              key={color.value}
              className="rb-color-dot"
              style={{ backgroundColor: color.value }}
              title={color.label}
              aria-label={`Highlight ${color.label}`}
              onClick={(e) => {
                e.stopPropagation();
                onHighlight(color.value, note);
              }}
            />
          ))}
        </div>

        <div className="rb-divider" />

        {onSummarize && (
          <button
            type="button"
            className="rb-icon-btn"
            title="Summarize"
            aria-label="Summarize selection"
            onClick={(e) => {
              e.stopPropagation();
              onSummarize(note);
            }}
          >
            </button>
        )}

        <button
          type="button"
          className="rb-icon-btn"
          title="Add note"
          aria-label="Add note"
          aria-expanded={isAddingNote}
          onClick={(e) => {
            e.stopPropagation();
            setIsAddingNote(!isAddingNote);
          }}
        >
          <HiOutlinePencilAlt />
        </button>
      </div>

      {isAddingNote && (
        <div className="rb-note-row">
          <input
            autoFocus
            type="text"
            name="highlight-note"
            maxLength={4000}
            className="rb-note-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Type a note..."
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onHighlight(COLORS[0].value, note);
              }
              if (e.key === 'Escape') {
                setIsAddingNote(false);
              }
            }}
          />
          <button
            type="button"
            className="rb-icon-btn rb-icon-btn--sm"
            title="Save"
            aria-label="Save highlight note"
            onClick={(e) => {
              e.stopPropagation();
              onHighlight(COLORS[0].value, note);
            }}
          >
            <HiX style={{ transform: 'rotate(45deg)' }} />
          </button>
        </div>
      )}
    </div>
  );
}
