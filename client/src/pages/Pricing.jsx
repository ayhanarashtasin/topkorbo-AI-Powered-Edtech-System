import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiCheck, HiX } from 'react-icons/hi';
import { initPayment } from '../services/paymentApi';
import { usePlan } from '../hooks/usePlan';
import MentorPricing from './MentorPricing';
import './Pricing.css';

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    tagline: 'Get started, no cost',
    features: [
      { text: '5 question-bank exams', included: true },
      { text: '5 mock tests', included: true },
      { text: '3 battle rooms', included: true },
      { text: 'AI features (limited)', included: true },
      { text: 'Read up to 2 books', included: true },
      { text: 'Reading tools (pen / highlighter / notes)', included: false },
      { text: 'Reading AI (summarize / chat / mind-map)', included: false }
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 150,
    tagline: 'Unlimited practice',
    highlight: true,
    features: [
      { text: 'Unlimited question-bank exams', included: true },
      { text: 'Unlimited mock tests', included: true },
      { text: 'Unlimited battle rooms', included: true },
      { text: 'Unlimited AI features', included: true },
      { text: 'Read unlimited books', included: true },
      { text: 'Reading tools (pen / highlighter / notes)', included: false },
      { text: 'Reading AI (summarize / chat / mind-map)', included: false }
    ]
  },
  {
    id: 'pro_plus',
    name: 'Pro+',
    price: 250,
    tagline: 'Everything, unlocked',
    features: [
      { text: 'Unlimited question-bank exams', included: true },
      { text: 'Unlimited mock tests', included: true },
      { text: 'Unlimited battle rooms', included: true },
      { text: 'Unlimited AI features', included: true },
      { text: 'Read unlimited books', included: true },
      { text: 'Reading tools (pen / highlighter / notes)', included: true },
      { text: 'Reading AI (summarize / chat / mind-map)', included: true }
    ]
  }
];

export default function Pricing() {
  const userRole = (localStorage.getItem('topkorbo_role') || '').toLowerCase();
  if (userRole === 'tutor') {
    return <MentorPricing />;
  }

  const { plan: currentPlan, loading } = usePlan();
  const [busy, setBusy] = useState(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const status = searchParams.get('payment');
    if (status === 'failed') toast.error('Payment failed. Please try again.');
    else if (status === 'cancelled') toast('Payment cancelled.');
    else if (status === 'error') toast.error('Something went wrong with the payment.');
  }, [searchParams]);

  const handleUpgrade = async (planId) => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) {
      toast.error('Please log in first.');
      return;
    }
    setBusy(planId);
    try {
      const { url } = await initPayment(planId);
      if (url) window.location.href = url;
      else toast.error('Could not start checkout.');
    } catch (err) {
      toast.error(err?.message || 'Could not start checkout.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="pricing">
      <div className="pricing__header">
        <h1 className="pricing__title">Choose your plan</h1>
        <p className="pricing__subtitle">
          Upgrade anytime. Paid plans are billed monthly (30 days) and renew when you choose.
        </p>
      </div>

      <div className="pricing__grid">
        {TIERS.map((tier) => {
          const isCurrent = !loading && currentPlan === tier.id;
          const isFree = tier.id === 'free';
          return (
            <div
              key={tier.id}
              className={`pricing__card ${tier.highlight ? 'pricing__card--highlight' : ''} ${isCurrent ? 'pricing__card--current' : ''}`}
            >
              {tier.highlight && <div className="pricing__badge">Most popular</div>}
              <h2 className="pricing__plan-name">{tier.name}</h2>
              <p className="pricing__tagline">{tier.tagline}</p>
              <div className="pricing__price">
                <span className="pricing__amount">{tier.price}</span>
                <span className="pricing__currency">tk{!isFree ? ' / mo' : ''}</span>
              </div>

              <ul className="pricing__features">
                {tier.features.map((f, i) => (
                  <li key={i} className={f.included ? 'is-in' : 'is-out'}>
                    {f.included ? <HiCheck /> : <HiX />}
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button className="pricing__btn pricing__btn--current" disabled>
                  Current plan
                </button>
              ) : isFree ? (
                <button className="pricing__btn pricing__btn--ghost" disabled>
                  Free forever
                </button>
              ) : (
                <button
                  className="pricing__btn"
                  onClick={() => handleUpgrade(tier.id)}
                  disabled={busy === tier.id}
                >
                  {busy === tier.id ? 'Redirecting…' : `Upgrade to ${tier.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
