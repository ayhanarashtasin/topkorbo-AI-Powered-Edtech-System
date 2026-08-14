import React from 'react';
import { HiSparkles, HiLockClosed } from 'react-icons/hi';
import './SubscriptionBanner.css';

export default function SubscriptionBanner({ authState, subscription, trialDaysLeft, planExpiresAt, planIsTrial }) {
  if (authState === 'guest') {
    return (
      <div className="pricing-hero">
        <h1 className="pricing-title">Choose the plan that fits your preparation</h1>
        <p className="pricing-subtitle">
          Create a free account to start learning and unlock your personalized study experience.
        </p>
      </div>
    );
  }

  // Authenticated Banner Content
  let bannerText = '';
  let subtitleText = '';
  let isPro = false;
  let isProPlus = false;

  if (subscription === 'free') {
    bannerText = "You're currently on the Free plan";
    subtitleText = "Upgrade to unlock unlimited practice, AI-powered learning, mock tests, and more.";
  } else if (subscription === 'pro') {
    isPro = true;
    bannerText = "You're on the Pro plan";
    subtitleText = "Enjoy unlimited practice and AI-powered learning. Upgrade to Pro+ whenever you're ready for the complete experience.";
  } else if (subscription === 'pro_plus') {
    isProPlus = true;
    bannerText = "You're on the Pro+ plan";
    subtitleText = "You have access to all premium learning features.";
  }

  return (
    <div className="pricing-hero">
      <span className="pricing-badge">
        <HiSparkles className="pricing-badge-icon" /> Premium Student Access
      </span>
      <h1 className="pricing-title">{bannerText}</h1>
      <p className="pricing-subtitle">{subtitleText}</p>

      {planIsTrial && subscription !== 'free' && (
        <div className="pricing-trial-banner">
          <HiSparkles className="pricing-trial-banner-icon" />
          <span>
            You are currently enjoying your <strong>5-Day Free Trial</strong> of Pro+.
            {planExpiresAt && (
              <> Trial ends in <strong>{trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'}</strong> (Expires {new Date(planExpiresAt).toLocaleDateString([], { dateStyle: 'medium' })}).</>
            )} Upgrade to a paid plan below to keep all premium features!
          </span>
        </div>
      )}

      {subscription === 'free' && (
        <div className="pricing-locked-banner">
          <HiLockClosed className="pricing-locked-banner-icon" />
          <span>
            Access to reading tools, reading AI, and daily usage limits for exams and AI tools are restricted. Upgrade to a paid plan below to unlock unlimited learning!
          </span>
        </div>
      )}
    </div>
  );
}
