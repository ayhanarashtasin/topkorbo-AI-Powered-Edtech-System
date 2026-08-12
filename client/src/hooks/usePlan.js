/**
 * usePlan — fetches the current user's effective plan + lifetime usage from
 * GET /api/auth/me and derives cosmetic UI gating helpers. The server is the
 * real enforcement point; this is only for hiding/disabling controls and
 * showing usage bars.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import httpClient from '../services/httpClient';

// Mirror of server/config/plans.js (kept small + in sync by hand).
export const PLAN_LIMITS = {
  free: { qbankExams: 5, mockTests: 5, battleRooms: 3, aiActions: 20, readingBooks: 2 },
  pro: {},
  pro_3months: {},
  pro_6months: {},
  pro_yearly: {},
  pro_plus: {},
  pro_plus_3months: {},
  pro_plus_6months: {},
  pro_plus_yearly: {},
  mentor_pro: {},
  mentor_3months: {},
  mentor_6months: {},
  mentor_yearly: {}
};

export const PLAN_META = {
  free: { label: 'Free', price: 0 },
  pro: { label: 'Pro (1 Month)', price: 150 },
  pro_3months: { label: 'Pro (3 Months)', price: 390 },
  pro_6months: { label: 'Pro (6 Months)', price: 600 },
  pro_yearly: { label: 'Pro (1 Year)', price: 840 },
  pro_plus: { label: 'Pro+ (1 Month)', price: 250 },
  pro_plus_3months: { label: 'Pro+ (3 Months)', price: 630 },
  pro_plus_6months: { label: 'Pro+ (6 Months)', price: 960 },
  pro_plus_yearly: { label: 'Pro+ (1 Year)', price: 1320 },
  mentor_pro: { label: 'Mentor Pro (1 Month)', price: 1499 },
  mentor_3months: { label: 'Mentor Pro (3 Months)', price: 3897 },
  mentor_6months: { label: 'Mentor Pro (6 Months)', price: 5994 },
  mentor_yearly: { label: 'Mentor Pro (1 Year)', price: 8400 }
};

const PRO_PLANS = ['pro', 'pro_3months', 'pro_6months', 'pro_yearly'];
const PRO_PLUS_PLANS = ['pro_plus', 'pro_plus_3months', 'pro_plus_6months', 'pro_plus_yearly'];
const MENTOR_PLANS = ['mentor_pro', 'mentor_3months', 'mentor_6months', 'mentor_yearly'];
const PLAN_RANK = {
  free: 0,
  pro: 1, pro_3months: 1, pro_6months: 1, pro_yearly: 1,
  pro_plus: 2, pro_plus_3months: 2, pro_plus_6months: 2, pro_plus_yearly: 2,
  mentor_pro: 2, mentor_3months: 2, mentor_6months: 2, mentor_yearly: 2
};

export function usePlan() {
  const [plan, setPlan] = useState(() => {
    try { return localStorage.getItem('topkorbo_plan') || 'free'; } catch { return 'free'; }
  });
  const [usage, setUsage] = useState({ qbankExams: 0, mockTests: 0, battleRooms: 0, aiActions: 0 });
  const [planExpiresAt, setPlanExpiresAt] = useState(null);
  const [planIsTrial, setPlanIsTrial] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = localStorage.getItem('topkorbo_token');
      if (!token) { setLoading(false); return; }
      const data = await httpClient.request('/auth/me');
      if (data) {
        const p = data.plan || 'free';
        setPlan(p);
        setUsage(data.usage || { qbankExams: 0, mockTests: 0, battleRooms: 0, aiActions: 0 });
        setPlanExpiresAt(data.planExpiresAt || null);
        setPlanIsTrial(!!data.planIsTrial);
        try { localStorage.setItem('topkorbo_plan', p); } catch { /* ignore */ }
      }
    } catch {
      /* keep last-known plan */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const helpers = useMemo(() => {
    const limits = PLAN_LIMITS[plan] || {};
    const atLeast = (required) => (PLAN_RANK[plan] || 0) >= (PLAN_RANK[required] || 0);
    const remaining = (key) => {
      const cap = limits[key];
      if (cap === undefined) return Infinity; // unlimited on this plan
      return Math.max(0, cap - (usage[key] || 0));
    };
    return {
      isFree: plan === 'free',
      isPro: PRO_PLANS.includes(plan),
      isProPlus: PRO_PLUS_PLANS.includes(plan),
      isMentorPro: MENTOR_PLANS.includes(plan),
      canReadingTools: [...PRO_PLUS_PLANS, ...MENTOR_PLANS].includes(plan),
      canReadingAI: [...PRO_PLUS_PLANS, ...MENTOR_PLANS].includes(plan),
      atLeast,
      remaining,
      limitOf: (key) => (limits[key] === undefined ? Infinity : limits[key])
    };
  }, [plan, usage]);

  return { plan, usage, planExpiresAt, planIsTrial, loading, refresh, ...helpers };
}

export default usePlan;
