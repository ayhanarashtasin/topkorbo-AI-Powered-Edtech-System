import React from 'react';
import './ComparisonTable.css';
import { COMPARISON_FEATURES } from './PricingData';
import { HiCheck, HiMinus } from 'react-icons/hi';

export default function ComparisonTable() {
  return (
    <div className="comparison-table-wrapper">
      <h2 className="comparison-title">Compare Plans</h2>
      <div className="comparison-table-container">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Free</th>
              <th className="highlight-col">Pro</th>
              <th>Pro+</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_FEATURES.map((feature, idx) => (
              <tr key={idx}>
                <td className="feature-name">{feature.name}</td>
                <td>{renderCell(feature.free)}</td>
                <td className="highlight-col">{renderCell(feature.pro)}</td>
                <td>{renderCell(feature.proPlus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderCell(value) {
  if (value === '-') {
    return <HiMinus className="icon-minus" />;
  }
  if (value === 'Included') {
    return (
      <span className="included-cell">
        <HiCheck className="icon-check" />
      </span>
    );
  }
  return value;
}
