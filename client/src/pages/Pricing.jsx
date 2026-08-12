import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiCheck, HiX, HiArrowLeft, HiSparkles, HiLockClosed } from 'react-icons/hi';
import { initPayment } from '../services/paymentApi';
import { usePlan } from '../hooks/usePlan';
import MentorPricing from './MentorPricing';
import './Pricing.css';

const STUDENT_DURATION_OPTIONS = [
  {
    id: '1month',
    label: '1 Month',
    badge: null,
    saveText: null,
    pro: { planId: 'pro', effectiveMonthly: 150, totalPrice: 150 },
    proPlus: { planId: 'pro_plus', effectiveMonthly: 250, totalPrice: 250 }
  },
  {
    id: 'yearly',
    label: '1 Year',
    badge: 'Best Value 🌟',
    highlight: true,
    saveText: 'Save up to 53%',
    pro: { planId: 'pro_yearly', effectiveMonthly: 70, totalPrice: 840, saveAmount: 960 },
    proPlus: { planId: 'pro_plus_yearly', effectiveMonthly: 110, totalPrice: 1320, saveAmount: 1680 }
  }
];

const BASE_FEATURES_PRO = [
  { text: 'Unlimited question-bank exams', included: true },
  { text: 'Unlimited mock tests', included: true },
  { text: 'Unlimited battle rooms', included: true },
  { text: 'Unlimited AI features', included: true },
  { text: 'Read unlimited books', included: true },
  { text: 'Reading tools (pen / highlighter / notes)', included: false },
  { text: 'Reading AI (summarize / chat / mind-map)', included: false }
];

const BASE_FEATURES_PRO_PLUS = [
  { text: 'Unlimited question-bank exams', included: true },
  { text: 'Unlimited mock tests', included: true },
  { text: 'Unlimited battle rooms', included: true },
  { text: 'Unlimited AI features', included: true },
  { text: 'Read unlimited books', included: true },
  { text: 'Reading tools (pen / highlighter / notes)', included: true },
  { text: 'Reading AI (summarize / chat / mind-map)', included: true }
];

export default function Pricing() {
  const navigate = useNavigate();
  const userRole = (localStorage.getItem('topkorbo_role') || '').toLowerCase();
  
  if (userRole === 'tutor') {
    return <MentorPricing />;
  }

  const { plan: currentPlan, planExpiresAt, planIsTrial, loading } = usePlan();
  const [selectedDuration, setSelectedDuration] = useState('yearly');
  const [busy, setBusy] = useState(null);
  const [searchParams] = useSearchParams();

  const isFree = currentPlan === 'free';
  const trialDaysLeft = planExpiresAt
    ? Math.max(0, Math.ceil((new Date(planExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  const activeDurationOpt = STUDENT_DURATION_OPTIONS.find(opt => opt.id === selectedDuration) || STUDENT_DURATION_OPTIONS[3];

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

  // Determine current active plan matching helper
  const isCurrentPlan = (tierId) => {
    if (loading) return false;
    if (tierId === 'free') return currentPlan === 'free';
    if (tierId === 'pro') {
      return ['pro', 'pro_3months', 'pro_6months', 'pro_yearly'].includes(currentPlan);
    }
    if (tierId === 'pro_plus') {
      return ['pro_plus', 'pro_plus_3months', 'pro_plus_6months', 'pro_plus_yearly'].includes(currentPlan);
    }
    return false;
  };

  // Map tiers dynamically using state and configs
  const tiers = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      periodText: 'Life-time limits',
      tagline: 'Get started, no cost',
      targetPlanId: 'free',
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
      price: activeDurationOpt.pro.effectiveMonthly,
      periodText: `Billed ৳${activeDurationOpt.pro.totalPrice.toLocaleString()} total`,
      tagline: 'Unlimited practice',
      targetPlanId: activeDurationOpt.pro.planId,
      saveText: activeDurationOpt.pro.saveAmount ? `Save ৳${activeDurationOpt.pro.saveAmount}` : null,
      features: BASE_FEATURES_PRO
    },
    {
      id: 'pro_plus',
      name: 'Pro+',
      price: activeDurationOpt.proPlus.effectiveMonthly,
      periodText: `Billed ৳${activeDurationOpt.proPlus.totalPrice.toLocaleString()} total`,
      tagline: 'Everything, unlocked',
      targetPlanId: activeDurationOpt.proPlus.planId,
      highlight: true,
      saveText: activeDurationOpt.proPlus.saveAmount ? `Save ৳${activeDurationOpt.proPlus.saveAmount}` : null,
      features: BASE_FEATURES_PRO_PLUS
    }
  ];

  return (
    <div className="pricing">
      <div className="pricing__header-bar">
        <button
          type="button"
          className="pricing__back-btn"
          onClick={() => navigate('/dashboard')}
        >
          <HiArrowLeft /> Back to Dashboard
        </button>
      </div>

      <div className="pricing__hero">
        <span className="pricing__badge">
          <HiSparkles className="pricing__badge-icon" /> Premium Student Access
        </span>
        <h1 className="pricing__title">Choose Your Prep Plan</h1>
        <p className="pricing__subtitle">
          Upgrade anytime to unlock unlimited question-bank practice, intensive mock tests, quiz battles, and AI-powered learning tools.
        </p>

        {planIsTrial && !isFree && (
          <div className="pricing__trial-banner">
            <HiSparkles className="pricing__trial-banner-icon" />
            <span>
              You are currently enjoying your <strong>5-Day Free Trial</strong> of Pro+.
              {planExpiresAt && (
                <> Trial ends in <strong>{trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'}</strong> (Expires {new Date(planExpiresAt).toLocaleDateString([], { dateStyle: 'medium' })}).</>
              )} Upgrade to a paid plan below to keep all premium features!
            </span>
          </div>
        )}

        {isFree && !loading && (
          <div className="pricing__locked-banner">
            <HiLockClosed className="pricing__locked-banner-icon" />
            <span>
              You are on the Free tier. Access to reading tools, reading AI, and daily usage limits for exams and AI tools are restricted. Upgrade to a paid plan below to unlock unlimited learning!
            </span>
          </div>
        )}

        {/* Plan Duration Selector Grid */}
        <div className="pricing__duration-grid">
          {STUDENT_DURATION_OPTIONS.map((opt) => {
            const isSelected = selectedDuration === opt.id;
            return (
              <div
                key={opt.id}
                className={`pricing__duration-card ${isSelected ? 'is-selected' : ''} ${opt.highlight ? 'is-highlight' : ''}`}
                onClick={() => setSelectedDuration(opt.id)}
              >
                {opt.badge && <span className="pricing__duration-badge">{opt.badge}</span>}
                <div className="pricing__duration-header">
                  <span className="pricing__duration-title">{opt.label}</span>
                  {opt.saveText && <span className="pricing__duration-save">{opt.saveText}</span>}
                </div>
                <div className="pricing__duration-price-summary">
                  Pro: ৳{opt.pro.effectiveMonthly}/mo · Pro+: ৳{opt.proPlus.effectiveMonthly}/mo
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pricing__grid">
        {tiers.map((tier) => {
          const isCurrent = isCurrentPlan(tier.id);
          const isFreeTier = tier.id === 'free';
          return (
            <div
              key={tier.id}
              className={`pricing__card ${tier.highlight ? 'pricing__card--highlight' : ''} ${isCurrent ? 'pricing__card--current' : ''}`}
            >
              {tier.highlight && <div className="pricing__card-badge">Most popular</div>}
              <h2 className="pricing__plan-name">{tier.name}</h2>
              <p className="pricing__tagline">{tier.tagline}</p>
              
              <div className="pricing__price">
                <span className="pricing__currency-symbol">৳</span>
                <span className="pricing__amount">{tier.price}</span>
                <span className="pricing__currency-unit">{!isFreeTier ? ' / mo' : ''}</span>
              </div>
              
              {!isFreeTier && (
                <div className="pricing__billing-text-row">
                  <span className="pricing__billing-text-info">{tier.periodText}</span>
                  {tier.saveText && <span className="pricing__billing-text-save">{tier.saveText}</span>}
                </div>
              )}

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
                  Current Plan
                </button>
              ) : isFreeTier ? (
                <button className="pricing__btn pricing__btn--disabled" disabled>
                  Free Forever
                </button>
              ) : (
                <button
                  className="pricing__btn"
                  onClick={() => handleUpgrade(tier.targetPlanId)}
                  disabled={busy === tier.targetPlanId}
                >
                  {busy === tier.targetPlanId ? 'Redirecting…' : `Upgrade to ${tier.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
