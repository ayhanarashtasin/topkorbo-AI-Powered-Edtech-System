import React from 'react';
import { HiCheck, HiX } from 'react-icons/hi';
import './PricingCard.css';

export function FeatureList({ features }) {
  return (
    <ul className="pricing-features">
      {features.map((f, i) => (
        <li key={i} className={f.included ? 'is-in' : 'is-out'}>
          {f.included ? <HiCheck /> : <HiX />}
          <span>{f.text}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PricingCard({
  tier,
  isCurrent,
  isFreeTier,
  ctaProps,
  badgeText
}) {
  return (
    <div
      className={`pricing-card ${tier.highlight ? 'pricing-card--highlight' : ''} ${isCurrent ? 'pricing-card--current' : ''}`}
    >
      {badgeText && <div className="pricing-card-badge">{badgeText}</div>}
      <h2 className="pricing-plan-name">{tier.name}</h2>
      <p className="pricing-tagline">{tier.tagline}</p>

      <div className="pricing-price">
        <span className="pricing-currency-symbol">৳</span>
        <span className="pricing-amount">{tier.price}</span>
        <span className="pricing-currency-unit">{!isFreeTier ? ' / mo' : ''}</span>
      </div>

      {!isFreeTier && (
        <div className="pricing-billing-text-row">
          <span className="pricing-billing-text-info">{tier.periodText}</span>
          {tier.saveText && <span className="pricing-billing-text-save">{tier.saveText}</span>}
        </div>
      )}

      {isFreeTier && (
        <div className="pricing-billing-text-row">
          <span className="pricing-billing-text-info">No credit card required</span>
        </div>
      )}

      <FeatureList features={tier.features} />

      <button
        className={`pricing-btn ${ctaProps.disabled || ctaProps.isInactive ? 'pricing-btn--disabled' : ''} ${isCurrent ? 'pricing-btn--current' : ''} ${ctaProps.isDowngrade ? 'pricing-btn--downgrade' : ''}`}
        onClick={ctaProps.onClick}
        disabled={ctaProps.disabled}
      >
        {ctaProps.loading ? 'Redirecting…' : ctaProps.text}
      </button>
    </div>
  );
}
