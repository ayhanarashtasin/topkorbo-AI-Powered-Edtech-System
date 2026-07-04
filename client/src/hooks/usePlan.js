/**
 * usePlan — fetches the current user's effective plan + lifetime usage from
 * GET /api/auth/me and derives cosmetic UI gating helpers. The server is the
 * real enforcement point; this is only for hiding/disabling controls and
 * showing usage bars.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Mirror of server/config/plans.js (kept small + in sync by hand).
export const PLAN_LIMITS = {
  free: { qbankExams: 5, mockTests: 5, battleRooms: 3, aiActions: 20, readingBooks: 2 },
  pro: {},
  pro_plus: {}
};

export const PLAN_META = {
  free: { label: 'Free', price: 0 },
  pro: { label: 'Pro', price: 150 },
  pro_plus: { label: 'Pro+', price: 250 }
};

const PLAN_RANK = { free: 0, pro: 1, pro_plus: 2 };

export function usePlan() {
  const [plan, setPlan] = useState(() => {
    try { return localStorage.getItem('topkorbo_plan') || 'free'; } catch (_) { return 'free'; }
  });
  const [usage, setUsage] = useState({ qbankExams: 0, mockTests: 0, battleRooms: 0, aiActions: 0 });
  const [planExpiresAt, setPlanExpiresAt] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = localStorage.getItem('topkorbo_token');
      if (!token) { setLoading(false); return; }
      const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => null);
      const data = json && json.data;
      if (data) {
        const p = data.plan || 'free';
        setPlan(p);
        setUsage(data.usage || { qbankExams: 0, mockTests: 0, battleRooms: 0, aiActions: 0 });
        setPlanExpiresAt(data.planExpiresAt || null);
        try { localStorage.setItem('topkorbo_plan', p); } catch (_) { /* ignore */ }
      }
    } catch (_) {
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
      isPro: plan === 'pro',
      isProPlus: plan === 'pro_plus',
      canReadingTools: plan === 'pro_plus',
      canReadingAI: plan === 'pro_plus',
      atLeast,
      remaining,
      limitOf: (key) => (limits[key] === undefined ? Infinity : limits[key])
    };
  }, [plan, usage]);

  return { plan, usage, planExpiresAt, loading, refresh, ...helpers };
}

export default usePlan;
