import React from 'react';
import './PricingToggle.css';
import { DURATION_OPTIONS } from './PricingData';

export default function PricingToggle({ selectedDuration, onSelectDuration }) {
  return (
    <div className="pricing-toggle-container">
      {DURATION_OPTIONS.map((opt) => {
        const isSelected = selectedDuration === opt.id;
        return (
          <div
            key={opt.id}
            className={`pricing-toggle-option ${isSelected ? 'selected' : ''} ${opt.highlight ? 'highlight' : ''}`}
            onClick={() => onSelectDuration(opt.id)}
          >
            {opt.badge && <span className="pricing-toggle-badge">{opt.badge}</span>}
            <div className="pricing-toggle-title">{opt.label}</div>
            {opt.saveText && <div className="pricing-toggle-save">{opt.saveText}</div>}
          </div>
        );
      })}
    </div>
  );
}
