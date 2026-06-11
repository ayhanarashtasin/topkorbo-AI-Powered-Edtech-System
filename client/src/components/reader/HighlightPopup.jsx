import React, { useState } from 'react';
import './HighlightPopup.css';

const COLORS = [
  { label: 'Yellow', value: '#FFEB3B' },
  { label: 'Green', value: '#4CAF50' },
  { label: 'Blue', value: '#2196F3' },
  { label: 'Pink', value: '#E91E63' },
];

export default function HighlightPopup({ position, onHighlight, onCancel }) {
  const [note, setNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  if (!position) return null;

  return (
    <div 
      className="rb-highlight-popup"
      style={{ left: position.x, top: position.y }}
    >
      {!isAddingNote ? (
        <div className="rb-highlight-popup-actions">
          <div className="rb-highlight-colors">
            {COLORS.map((color) => (
              <button
                key={color.value}
                className="rb-color-btn"
                style={{ backgroundColor: color.value }}
                title={color.label}
                onClick={(e) => {
                  e.stopPropagation();
                  onHighlight(color.value, note);
                }}
              />
            ))}
          </div>
          <button 
            className="rb-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsAddingNote(true);
            }}
          >
            Add Note
          </button>
        </div>
      ) : (
        <div className="rb-highlight-note-input">
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Type a note..."
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onHighlight(COLORS[0].value, note);
              }
            }}
          />
          <div className="rb-note-actions">
            <button onClick={() => onHighlight(COLORS[0].value, note)}>Save</button>
            <button onClick={() => setIsAddingNote(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
