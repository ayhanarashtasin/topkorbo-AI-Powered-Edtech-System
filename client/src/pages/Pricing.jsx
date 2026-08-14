import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiArrowLeft } from 'react-icons/hi';
import { initPayment } from '../services/paymentApi';
import { usePlan } from '../hooks/usePlan';
import MentorPricing from './MentorPricing';

// Components
import SubscriptionBanner from '../components/Pricing/SubscriptionBanner';
import PricingToggle from '../components/Pricing/PricingToggle';
import PricingCard from '../components/Pricing/PricingCard';
import ComparisonTable from '../components/Pricing/ComparisonTable';
import { DURATION_OPTIONS, BASE_FEATURES_FREE, BASE_FEATURES_PRO, BASE_FEATURES_PRO_PLUS } from '../components/Pricing/PricingData';

import './Pricing.css';

export default function Pricing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const userRole = (localStorage.getItem('topkorbo_role') || '').toLowerCase();
  const token = localStorage.getItem('topkorbo_token');

  if (userRole === 'tutor') {
    return <MentorPricing />;
  }

  const { plan: currentPlan, planExpiresAt, planIsTrial, loading } = usePlan();
  const [selectedDuration, setSelectedDuration] = useState('yearly');
  const [busy, setBusy] = useState(null);

  const authState = token ? 'authenticated' : 'guest';
  
  let subscription = 'free';
  if (!loading && currentPlan) {
    if (currentPlan.includes('pro_plus')) subscription = 'pro_plus';
    else if (currentPlan.includes('pro')) subscription = 'pro';
  }

  const trialDaysLeft = planExpiresAt
    ? Math.max(0, Math.ceil((new Date(planExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  const activeDurationOpt = DURATION_OPTIONS.find(opt => opt.id === selectedDuration) || DURATION_OPTIONS[1];

  useEffect(() => {
    const status = searchParams.get('payment');
    if (status === 'failed') toast.error('Payment failed. Please try again.');
    else if (status === 'cancelled') toast('Payment cancelled.');
    else if (status === 'error') toast.error('Something went wrong with the payment.');
    
    // Auto checkout for guest return flow
    const intendedPlan = searchParams.get('plan');
    if (authState === 'authenticated' && intendedPlan && !loading) {
      if (subscription === 'free' && intendedPlan !== 'free') {
        const planId = intendedPlan === 'pro' ? activeDurationOpt.pro.planId : activeDurationOpt.proPlus.planId;
        handleCheckout(planId);
      }
    }
  }, [searchParams, authState, loading, subscription, activeDurationOpt]);

  const handleAction = async (tierId) => {
    if (authState === 'guest') {
      const targetPlanId = tierId === 'free' ? '' : `?plan=${tierId}`;
      navigate(`/login${targetPlanId}`, { state: { from: location.pathname } });
      return;
    }

    if (tierId === 'free') {
      // Logic for downgrade API call or info
      toast('To downgrade, please manage your subscription in billing settings.');
      return;
    }

    const planId = tierId === 'pro' ? activeDurationOpt.pro.planId : activeDurationOpt.proPlus.planId;
    handleCheckout(planId);
  };

  const handleCheckout = async (planId) => {
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

  const getCtaProps = (tierId, targetPlanId) => {
    const props = {
      text: '',
      onClick: () => handleAction(tierId),
      disabled: false,
      isInactive: false,
      isDowngrade: false,
      loading: busy === targetPlanId
    };

    if (authState === 'guest') {
      props.text = tierId === 'free' ? 'Create Free Account' : `Get ${tierId === 'pro' ? 'Pro' : 'Pro+'}`;
      return props;
    }

    if (subscription === 'free') {
      if (tierId === 'free') {
        props.text = 'Current Plan';
        props.disabled = true;
        props.isInactive = true;
      } else {
        props.text = `Upgrade to ${tierId === 'pro' ? 'Pro' : 'Pro+'}`;
      }
      return props;
    }

    if (subscription === 'pro') {
      if (tierId === 'free') {
        props.text = 'Downgrade';
        props.isDowngrade = true;
      } else if (tierId === 'pro') {
        props.text = 'Current Plan';
        props.disabled = true;
        props.isInactive = true;
      } else {
        props.text = 'Upgrade to Pro+';
      }
      return props;
    }

    if (subscription === 'pro_plus') {
      if (tierId === 'free') {
        props.text = 'Downgrade';
        props.isDowngrade = true;
      } else if (tierId === 'pro') {
        props.text = 'Downgrade to Pro';
        props.isDowngrade = true;
      } else {
        props.text = 'Current Plan';
        props.disabled = true;
        props.isInactive = true;
      }
      return props;
    }
    return props;
  };

  const isCurrentPlan = (tierId) => {
    if (loading || authState === 'guest') return false;
    if (tierId === 'free') return subscription === 'free';
    if (tierId === 'pro') return subscription === 'pro';
    if (tierId === 'pro_plus') return subscription === 'pro_plus';
    return false;
  };

  const getBadgeText = (tierId) => {
    if (isCurrentPlan(tierId)) return 'Current Plan';
    if (tierId === 'pro_plus' && !isCurrentPlan(tierId)) return 'Most popular';
    return null;
  };

  const tiers = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      periodText: 'Life-time limits',
      tagline: 'Get started, no cost',
      targetPlanId: 'free',
      features: BASE_FEATURES_FREE
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

  if (loading) {
    return (
      <div className="pricing">
        <div className="pricing-skeleton">
          <div className="skeleton-title" />
          <div className="skeleton-subtitle" />
          <div className="pricing-grid">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pricing">
      <div className="pricing__header-bar">
        {authState === 'authenticated' ? (
          <button type="button" className="pricing__back-btn" onClick={() => navigate('/dashboard')}>
            <HiArrowLeft /> Back to Dashboard
          </button>
        ) : (
          <button type="button" className="pricing__back-btn" onClick={() => navigate('/')}>
            <HiArrowLeft /> Explore Platform
          </button>
        )}
      </div>

      {authState === 'authenticated' && subscription !== 'free' && (
        <div className="pricing-manage-subscription-top">
           <div className="sub-status">
             <span>Current plan: <strong>{subscription === 'pro' ? 'Pro' : 'Pro+'}</strong></span>
             <span className="dot">•</span>
             <span>Billing: <strong>{selectedDuration === 'yearly' ? 'Yearly' : 'Monthly'}</strong></span>
           </div>
           <button className="manage-sub-btn">Manage Subscription</button>
        </div>
      )}

      <SubscriptionBanner 
        authState={authState}
        subscription={subscription}
        trialDaysLeft={trialDaysLeft}
        planExpiresAt={planExpiresAt}
        planIsTrial={planIsTrial}
      />

      <PricingToggle 
        selectedDuration={selectedDuration}
        onSelectDuration={setSelectedDuration}
      />

      <div className="pricing__grid">
        {tiers.map((tier) => (
          <PricingCard
            key={tier.id}
            tier={tier}
            isCurrent={isCurrentPlan(tier.id)}
            isFreeTier={tier.id === 'free'}
            ctaProps={getCtaProps(tier.id, tier.targetPlanId)}
            badgeText={getBadgeText(tier.id)}
          />
        ))}
      </div>

      <ComparisonTable />
    </div>
  );
}
