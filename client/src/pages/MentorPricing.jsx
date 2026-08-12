import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiCheck, HiSparkles, HiVideoCamera, HiChartBar, HiBookOpen, HiAcademicCap, HiLightningBolt, HiShieldCheck, HiArrowLeft, HiLockClosed } from 'react-icons/hi';
import { initPayment } from '../services/paymentApi';
import { usePlan } from '../hooks/usePlan';
import './MentorPricing.css';

const MENTOR_DURATION_OPTIONS = [
  {
    id: 'mentor_pro',
    durationLabel: '1 Month',
    badge: null,
    effectiveMonthly: 1499,
    totalPrice: 1499,
    periodText: '30 Days access',
    saveText: null
  },
  {
    id: 'mentor_yearly',
    durationLabel: '1 Year',
    badge: 'Best Value 🌟',
    highlight: true,
    effectiveMonthly: 700,
    totalPrice: 8400,
    periodText: '365 Days access (৳700 / mo)',
    saveText: 'Save ৳9,588 (53% OFF)'
  }
];

export default function MentorPricing() {
  const navigate = useNavigate();
  const { plan: currentPlan, planExpiresAt, planIsTrial, loading } = usePlan();
  const [selectedPlanId, setSelectedPlanId] = useState('mentor_yearly');
  const [busy, setBusy] = useState(false);
  const [searchParams] = useSearchParams();

  const trialDaysLeft = planExpiresAt
    ? Math.max(0, Math.ceil((new Date(planExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  const isSubscribed = ['mentor_pro', 'mentor_3months', 'mentor_6months', 'mentor_yearly'].includes(currentPlan);
  const activePlanConfig = MENTOR_DURATION_OPTIONS.find((opt) => opt.id === selectedPlanId) || MENTOR_DURATION_OPTIONS[3];

  const getSubscribedLabel = () => {
    const labelMap = {
      mentor_pro: 'Mentor Pro (1 Month)',
      mentor_3months: 'Mentor Pro (3 Months)',
      mentor_6months: 'Mentor Pro (6 Months)',
      mentor_yearly: 'Mentor Pro (1 Year)'
    };
    const planTitle = labelMap[currentPlan] || 'Mentor Pro';
    if (planIsTrial) {
      const daysLeft = Math.max(0, Math.ceil((new Date(planExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      const expiryStr = new Date(planExpiresAt).toLocaleDateString([], { dateStyle: 'medium' });
      return `Active Plan: Free Trial (${planTitle}) — ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining (Expires ${expiryStr})`;
    }
    if (!planExpiresAt) return `Active Plan: ${planTitle}`;
    const daysLeft = Math.max(0, Math.ceil((new Date(planExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    const expiryStr = new Date(planExpiresAt).toLocaleDateString([], { dateStyle: 'medium' });
    return `Active Plan: ${planTitle} — ${daysLeft} days remaining (Expires ${expiryStr})`;
  };

  useEffect(() => {
    const status = searchParams.get('payment');
    const upgraded = searchParams.get('upgraded');
    if (upgraded === '1') {
      toast.success('🎉 Congratulations! Your Mentor Pro Plan is now active!');
    } else if (status === 'failed') {
      toast.error('Payment failed. Please try again.');
    } else if (status === 'cancelled') {
      toast('Payment cancelled.');
    } else if (status === 'error') {
      toast.error('Something went wrong during payment initialization.');
    }
  }, [searchParams]);

  const handleUpgrade = async () => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) {
      toast.error('Please log in first to purchase a plan.');
      return;
    }

    setBusy(true);
    try {
      const { url } = await initPayment(selectedPlanId);
      if (url) {
        window.location.href = url;
      } else {
        toast.error('Could not initiate SSLCommerz checkout session.');
      }
    } catch (err) {
      toast.error(err?.message || 'Could not start SSLCommerz checkout.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mentor-pricing">
      <div className="mentor-pricing__header-bar">
        <button
          type="button"
          className="mentor-pricing__back-btn"
          onClick={() => navigate('/dashboard')}
        >
          <HiArrowLeft /> Back to Dashboard
        </button>
      </div>

      <div className="mentor-pricing__hero">
        <span className="mentor-pricing__badge">
          <HiSparkles className="mentor-pricing__badge-icon" /> Exclusive Tutor Subscription
        </span>
        <h1 className="mentor-pricing__title">Accelerate Your Tutoring Success</h1>
        <p className="mentor-pricing__subtitle">
          Accept student connection requests for free on your dashboard. Upgrade to unlock live video classrooms,
          full question bank, practice tools, and AI capabilities.
        </p>

        {planIsTrial && isSubscribed && (
          <div className="mentor-pricing__trial-banner">
            <HiSparkles className="mentor-pricing__trial-banner-icon" />
            <span>
              You are currently enjoying your <strong>5-Day Free Trial</strong> of Mentor Pro.
              {planExpiresAt && (
                <> Trial ends in <strong>{trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'}</strong> (Expires {new Date(planExpiresAt).toLocaleDateString([], { dateStyle: 'medium' })}).</>
              )} Upgrade to a paid plan below to keep all tutor features unlocked!
            </span>
          </div>
        )}

        {!isSubscribed && !loading && (
          <div className="mentor-pricing__locked-banner">
            <HiLockClosed className="mentor-pricing__locked-banner-icon" />
            <span>
              Your free trial has expired or you do not have an active subscription. Live video classrooms, library tools, student analytics, and AI features are currently locked. Upgrade below to restore access!
            </span>
          </div>
        )}

        {/* Plan Duration Selector Grid */}
        <div className="mentor-pricing__duration-grid">
          {MENTOR_DURATION_OPTIONS.map((opt) => {
            const isSelected = selectedPlanId === opt.id;
            return (
              <div
                key={opt.id}
                className={`mentor-pricing__duration-card ${isSelected ? 'is-selected' : ''} ${opt.highlight ? 'is-highlight' : ''}`}
                onClick={() => setSelectedPlanId(opt.id)}
              >
                {opt.badge && <span className="mentor-pricing__duration-badge">{opt.badge}</span>}
                <div className="mentor-pricing__duration-header">
                  <span className="mentor-pricing__duration-title">{opt.durationLabel}</span>
                  {opt.saveText && <span className="mentor-pricing__duration-save">{opt.saveText}</span>}
                </div>
                <div className="mentor-pricing__duration-price">
                  <span className="mentor-pricing__duration-num">৳{opt.effectiveMonthly}</span>
                  <span className="mentor-pricing__duration-unit">/ mo</span>
                </div>
                <div className="mentor-pricing__duration-total">
                  Billed ৳{opt.totalPrice.toLocaleString()} total
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Pricing Summary Card */}
      <div className="mentor-pricing__card-wrapper">
        <div className="mentor-pricing__card">
          <div className="mentor-pricing__card-header">
            <div className="mentor-pricing__plan-meta">
              <h2>TopKorbo Mentor Pro — {activePlanConfig.durationLabel}</h2>
              <p>Everything you need to manage & teach your students</p>
            </div>
            <div className="mentor-pricing__price-box">
              <div className="mentor-pricing__amount-row">
                <span className="mentor-pricing__currency">৳</span>
                <span className="mentor-pricing__amount">{activePlanConfig.totalPrice.toLocaleString()}</span>
              </div>
              <p className="mentor-pricing__billing-note">{activePlanConfig.periodText}</p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="mentor-pricing__features-section">
            <h3>Plan Features & Privileges</h3>
            <div className="mentor-pricing__features-grid">
              <div className="mentor-pricing__feature-item">
                <div className="mentor-pricing__feature-icon">
                  <HiVideoCamera />
                </div>
                <div>
                  <h4>Live Video Classrooms</h4>
                  <p>Schedule and host live interactive video/audio classes powered by LiveKit.</p>
                </div>
              </div>

              <div className="mentor-pricing__feature-item">
                <div className="mentor-pricing__feature-icon">
                  <HiChartBar />
                </div>
                <div>
                  <h4>Student Analytics & Insights</h4>
                  <p>Track mock test attempts, total scores, and subject-wise breakdowns of connected students.</p>
                </div>
              </div>

              <div className="mentor-pricing__feature-item">
                <div className="mentor-pricing__feature-icon">
                  <HiBookOpen />
                </div>
                <div>
                  <h4>Unlimited Question Bank & Practice</h4>
                  <p>Explore unlimited question bank exams, varsity written questions, and board papers.</p>
                </div>
              </div>

              <div className="mentor-pricing__feature-item">
                <div className="mentor-pricing__feature-icon">
                  <HiLightningBolt />
                </div>
                <div>
                  <h4>Reading Books & AI Summarizer</h4>
                  <p>Access full digital library, pen/highlighter tools, and AI mind maps/summaries.</p>
                </div>
              </div>

              <div className="mentor-pricing__feature-item">
                <div className="mentor-pricing__feature-icon">
                  <HiAcademicCap />
                </div>
                <div>
                  <h4>Battle Rooms & History</h4>
                  <p>Participate in quiz battles and access complete practice test history.</p>
                </div>
              </div>

              <div className="mentor-pricing__feature-item">
                <div className="mentor-pricing__feature-icon">
                  <HiShieldCheck />
                </div>
                <div>
                  <h4>Community Forum & Directory Priority</h4>
                  <p>Full community discussions access, post creation, and priority mentor directory listing.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Guarantee / CTA Footer */}
          <div className="mentor-pricing__footer">
            {isSubscribed && (
              <div className="mentor-pricing__current-badge" style={{ marginBottom: '16px' }}>
                <HiCheck /> {getSubscribedLabel()}
              </div>
            )}
            
            <button
              type="button"
              className="mentor-pricing__cta-btn"
              onClick={handleUpgrade}
              disabled={busy || loading}
            >
              {busy
                ? 'Redirecting to SSLCommerz...'
                : isSubscribed
                  ? `Extend / Upgrade Plan (${activePlanConfig.durationLabel} — ৳${activePlanConfig.totalPrice.toLocaleString()})`
                  : `Upgrade to Mentor Pro (${activePlanConfig.durationLabel} — ৳${activePlanConfig.totalPrice.toLocaleString()})`}
            </button>
            <p className="mentor-pricing__secure-text">
              🔒 Instant activation & 100% secure checkout via SSLCommerz (bKash, Nagad, Cards, Net Banking)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
