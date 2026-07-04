import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { usePlan, PLAN_META } from '../../hooks/usePlan';
import './PlanPanel.css';

const USAGE_ROWS = [
  { key: 'qbankExams', label: 'Question-bank exams' },
  { key: 'mockTests', label: 'Mock tests' },
  { key: 'battleRooms', label: 'Battle rooms' },
  { key: 'aiActions', label: 'AI actions' }
];

export default function PlanPanel() {
  const { plan, usage, planExpiresAt, planIsTrial, loading, isFree, limitOf, refresh } = usePlan();
  const [searchParams, setSearchParams] = useSearchParams();

  const trialDaysLeft = planExpiresAt
    ? Math.max(0, Math.ceil((new Date(planExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  useEffect(() => {
    if (searchParams.get('upgraded') === '1') {
      toast.success('Your plan is now active. Enjoy! 🎉');
      refresh();
      const next = new URLSearchParams(searchParams);
      next.delete('upgraded');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, refresh]);

  const meta = PLAN_META[plan] || PLAN_META.free;

  return (
    <div className="plan-panel">
      <div className="plan-panel__head">
        <div>
          <span className="plan-panel__eyebrow">Subscription</span>
          <h3 className="plan-panel__title">
            {meta.label} plan
            {!isFree && planIsTrial && (
              <span className="plan-panel__expiry">
                {' '}· free trial · {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left
              </span>
            )}
            {!isFree && !planIsTrial && planExpiresAt && (
              <span className="plan-panel__expiry">
                {' '}· renews {new Date(planExpiresAt).toLocaleDateString()}
              </span>
            )}
          </h3>
        </div>
        <a href="/pricing" className="plan-panel__cta">
          {isFree ? 'Upgrade' : planIsTrial ? 'Upgrade' : 'Manage plan'}
        </a>
      </div>

      {isFree && !loading && (
        <div className="plan-panel__usage">
          {USAGE_ROWS.map((row) => {
            const cap = limitOf(row.key);
            const used = usage[row.key] || 0;
            const pct = cap === Infinity ? 0 : Math.min(100, Math.round((used / cap) * 100));
            return (
              <div key={row.key} className="plan-panel__usage-row">
                <div className="plan-panel__usage-top">
                  <span>{row.label}</span>
                  <span className="plan-panel__usage-count">
                    {used} / {cap === Infinity ? '∞' : cap}
                  </span>
                </div>
                <div className="plan-panel__bar">
                  <div
                    className={`plan-panel__bar-fill ${pct >= 100 ? 'is-full' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          <p className="plan-panel__note">
            Free limits are lifetime totals. Upgrade to Pro for unlimited exams, mock tests,
            battles and AI — or Pro+ to also unlock reading tools &amp; AI.
          </p>
        </div>
      )}

      {!isFree && (
        <p className="plan-panel__note">
          You have unlimited exams, mock tests, battles and AI.
          {plan === 'pro_plus'
            ? ' Reading tools and reading AI are unlocked.'
            : ' Upgrade to Pro+ to unlock reading tools and reading AI.'}
          {planIsTrial && (
            <>
              {' '}Your free trial ends in {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} —
              upgrade to keep these features.
            </>
          )}
        </p>
      )}
    </div>
  );
}
