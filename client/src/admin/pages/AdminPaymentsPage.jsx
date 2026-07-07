import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import AdminActionButton from '../components/AdminActionButton';
import AdminBadge from '../components/AdminBadge';
import AdminConfirmModal from '../components/AdminConfirmModal';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminLoadingState from '../components/AdminLoadingState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPagination from '../components/AdminPagination';
import AdminStatCard from '../components/AdminStatCard';
import AdminTable from '../components/AdminTable';
import {
  archiveAdminPaymentPlan,
  createAdminPaymentPlan,
  fetchAdminPaymentHistory,
  fetchAdminPaymentPlans,
  fetchAdminUserDetails,
  fetchAdminUsers,
  grantAdminPremiumAccess,
  revokeAdminPremiumAccess,
  updateAdminPaymentPlan
} from '../services/adminApi';

const PAYMENT_TABS = [
  { id: 'history', label: 'Payment History' },
  { id: 'plans', label: 'Subscription Plans' },
  { id: 'premium', label: 'Manual Premium Access' }
];

const PAYMENT_STATUS_OPTIONS = ['', 'pending', 'valid', 'failed', 'cancelled'];
const PLAN_STATUS_OPTIONS = ['', 'active', 'disabled', 'archived'];
const ACCESS_PLAN_OPTIONS = ['pro', 'pro_plus'];

function formatDate(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function toneForPaymentStatus(status) {
  if (status === 'valid') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'failed' || status === 'cancelled') return 'danger';
  return 'neutral';
}

function toneForPlanStatus(status) {
  if (status === 'active') return 'success';
  if (status === 'disabled') return 'warning';
  if (status === 'archived') return 'danger';
  return 'neutral';
}

function toneForPremium(plan) {
  if (plan === 'pro_plus') return 'success';
  if (plan === 'pro') return 'info';
  return 'neutral';
}

function emptyPlanForm() {
  return {
    id: '',
    name: '',
    price: '',
    currency: 'BDT',
    durationDays: 30,
    featuresText: '',
    accessPlan: 'pro',
    status: 'active',
    reason: ''
  };
}

function createPlanPayload(form) {
  return {
    name: form.name,
    price: Number(form.price),
    currency: form.currency,
    durationDays: Number(form.durationDays),
    accessPlan: form.accessPlan,
    status: form.status,
    features: form.featuresText.split('\n').map((item) => item.trim()).filter(Boolean),
    reason: form.reason
  };
}

export default function AdminPaymentsPage() {
  const [activeTab, setActiveTab] = useState('history');

  const [historyFilters, setHistoryFilters] = useState({
    search: '',
    status: '',
    plan: '',
    page: 1,
    limit: 10
  });
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentStats, setPaymentStats] = useState({
    grossAmount: 0,
    byStatus: { pending: 0, valid: 0, failed: 0, cancelled: 0 }
  });
  const [paymentPagination, setPaymentPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [gatewayConnected, setGatewayConnected] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  const [planFilters, setPlanFilters] = useState({
    search: '',
    status: '',
    page: 1,
    limit: 10
  });
  const [plans, setPlans] = useState([]);
  const [planStats, setPlanStats] = useState({ active: 0, disabled: 0, archived: 0 });
  const [planPagination, setPlanPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [plansLoading, setPlansLoading] = useState(true);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planForm, setPlanForm] = useState(emptyPlanForm());
  const [planSubmitting, setPlanSubmitting] = useState(false);
  const [planAction, setPlanAction] = useState(null);

  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserLoading, setSelectedUserLoading] = useState(false);
  const [premiumForm, setPremiumForm] = useState({
    planId: '',
    accessPlan: 'pro',
    expiresAt: '',
    reason: ''
  });
  const [premiumAction, setPremiumAction] = useState(null);

  async function loadPaymentHistory(nextFilters = historyFilters) {
    try {
      setPaymentsLoading(true);
      const data = await fetchAdminPaymentHistory(nextFilters);
      setPaymentHistory(data?.items || []);
      setPaymentStats(data?.stats || {
        grossAmount: 0,
        byStatus: { pending: 0, valid: 0, failed: 0, cancelled: 0 }
      });
      setPaymentPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
      setGatewayConnected(Boolean(data?.gatewayConnected));
    } catch (err) {
      toast.error(err.message || 'Failed to load payment history');
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function loadPlans(nextFilters = planFilters) {
    try {
      setPlansLoading(true);
      const data = await fetchAdminPaymentPlans(nextFilters);
      setPlans(data?.items || []);
      setPlanStats(data?.stats || { active: 0, disabled: 0, archived: 0 });
      setPlanPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      toast.error(err.message || 'Failed to load subscription plans');
    } finally {
      setPlansLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadPaymentHistory(historyFilters);
    }, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyFilters.page, historyFilters.status, historyFilters.plan]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadPaymentHistory({ ...historyFilters, page: 1 });
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyFilters.search]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadPlans(planFilters);
    }, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planFilters.page, planFilters.status]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadPlans({ ...planFilters, page: 1 });
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planFilters.search]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const query = userSearch.trim();
      if (!query) {
        setUserResults([]);
        setUserSearchLoading(false);
        return;
      }

      try {
        setUserSearchLoading(true);
        const data = await fetchAdminUsers({ search: query, page: 1, limit: 8 });
        setUserResults(data?.items || []);
      } catch (err) {
        toast.error(err.message || 'Failed to search users');
      } finally {
        setUserSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [userSearch]);

  useEffect(() => {
    let active = true;

    async function loadSelectedUser() {
      if (!selectedUserId) return;
      try {
        setSelectedUserLoading(true);
        const data = await fetchAdminUserDetails(selectedUserId);
        if (!active) return;
        setSelectedUser(data);
      } catch (err) {
        if (active) {
          toast.error(err.message || 'Failed to load user premium status');
        }
      } finally {
        if (active) {
          setSelectedUserLoading(false);
        }
      }
    }

    const timeout = setTimeout(() => {
      loadSelectedUser();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [selectedUserId]);

  const selectedPlan = useMemo(
    () => plans.find((item) => item.id === premiumForm.planId) || null,
    [plans, premiumForm.planId]
  );

  function openCreatePlanModal() {
    setPlanForm(emptyPlanForm());
    setPlanModalOpen(true);
  }

  function openEditPlanModal(plan) {
    setPlanForm({
      id: plan.id,
      name: plan.name,
      price: String(plan.price),
      currency: plan.currency,
      durationDays: plan.durationDays,
      featuresText: (plan.features || []).join('\n'),
      accessPlan: plan.accessPlan,
      status: plan.status,
      reason: ''
    });
    setPlanModalOpen(true);
  }

  async function handlePlanSubmit(event) {
    event.preventDefault();
    try {
      setPlanSubmitting(true);
      const payload = createPlanPayload(planForm);
      if (planForm.id) {
        await updateAdminPaymentPlan(planForm.id, payload);
        toast.success('Plan updated');
      } else {
        await createAdminPaymentPlan(payload);
        toast.success('Plan created');
      }
      setPlanModalOpen(false);
      setPlanForm(emptyPlanForm());
      await loadPlans();
    } catch (err) {
      toast.error(err.message || 'Failed to save plan');
    } finally {
      setPlanSubmitting(false);
    }
  }

  async function handlePlanActionConfirm(reason) {
    try {
      if (planAction?.type === 'archive') {
        await archiveAdminPaymentPlan(planAction.planId, { reason });
        toast.success('Plan archived');
      } else if (planAction?.type === 'disable') {
        await updateAdminPaymentPlan(planAction.planId, { status: 'disabled', reason });
        toast.success('Plan disabled');
      } else if (planAction?.type === 'activate') {
        await updateAdminPaymentPlan(planAction.planId, { status: 'active', reason });
        toast.success('Plan activated');
      }
      setPlanAction(null);
      await loadPlans();
    } catch (err) {
      toast.error(err.message || 'Failed to update plan status');
    }
  }

  async function handlePremiumConfirm() {
    try {
      if (!selectedUserId) {
        toast.error('Select a user first');
        return;
      }

      if (premiumAction?.type === 'grant') {
        await grantAdminPremiumAccess(selectedUserId, {
          planId: premiumForm.planId || undefined,
          accessPlan: premiumForm.planId ? undefined : premiumForm.accessPlan,
          expiresAt: premiumForm.expiresAt,
          reason: premiumForm.reason
        });
        toast.success('Premium access granted');
      } else if (premiumAction?.type === 'revoke') {
        await revokeAdminPremiumAccess(selectedUserId, {
          reason: premiumForm.reason
        });
        toast.success('Premium access revoked');
      }

      setPremiumAction(null);
      setPremiumForm((prev) => ({ ...prev, reason: '' }));
      const userData = await fetchAdminUserDetails(selectedUserId);
      setSelectedUser(userData);
    } catch (err) {
      toast.error(err.message || 'Failed to update premium access');
    }
  }

  function renderTabs() {
    return (
      <div className="admin-tabs" role="tablist" aria-label="Payment administration tabs">
        {PAYMENT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`admin-tab ${activeTab === tab.id ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        title="Payments"
        description="Inspect real payment records, manage the future-safe subscription plan catalog, and grant or revoke premium access without touching roles or login behavior."
        badge={{ label: `${paymentPagination.total} payments`, tone: 'info' }}
        actions={
          activeTab === 'plans' ? (
            <AdminActionButton onClick={openCreatePlanModal}>Create plan</AdminActionButton>
          ) : null
        }
      />

      {renderTabs()}

      {activeTab === 'history' ? (
        <>
          <div className="admin-stats-grid">
            <AdminStatCard label="Payments" value={paymentPagination.total} hint="Real persisted payment rows only" tone="info" />
            <AdminStatCard label="Successful" value={paymentStats.byStatus.valid || 0} hint="Validated by the gateway" tone="success" />
            <AdminStatCard label="Pending" value={paymentStats.byStatus.pending || 0} hint="Waiting for validation callback" tone="warning" />
            <AdminStatCard label="Failed / cancelled" value={(paymentStats.byStatus.failed || 0) + (paymentStats.byStatus.cancelled || 0)} hint="Unsuccessful checkout attempts" tone="danger" />
            <AdminStatCard label="Gateway status" value={gatewayConnected ? 'Connected' : 'Not connected'} hint="Live payment config availability" tone={gatewayConnected ? 'success' : 'neutral'} />
          </div>

          <section className="admin-panel">
            <div className="admin-toolbar">
              <label className="admin-field admin-field--search">
                <span>Search</span>
                <input
                  value={historyFilters.search}
                  onChange={(event) => setHistoryFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
                  placeholder="User, email, or transaction id"
                />
              </label>

              <label className="admin-field">
                <span>Status</span>
                <select value={historyFilters.status} onChange={(event) => setHistoryFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))}>
                  <option value="">All statuses</option>
                  {PAYMENT_STATUS_OPTIONS.filter(Boolean).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Plan</span>
                <select value={historyFilters.plan} onChange={(event) => setHistoryFilters((prev) => ({ ...prev, plan: event.target.value, page: 1 }))}>
                  <option value="">All plans</option>
                  <option value="pro">Pro</option>
                  <option value="pro_plus">Pro+</option>
                </select>
              </label>
            </div>

            {paymentsLoading ? (
              <AdminLoadingState label="Loading payment history..." />
            ) : paymentHistory.length === 0 ? (
              <AdminEmptyState
                title={gatewayConnected ? 'No payments found yet' : 'No payment system is connected yet.'}
                description={gatewayConnected
                  ? 'Real payment records will appear here as users complete or attempt checkout.'
                  : 'The admin payment history stays empty until a real gateway is configured and starts writing payment records.'}
              />
            ) : (
              <>
                <AdminTable
                  columns={['User', 'Amount', 'Currency', 'Status', 'Payment method', 'Transaction id', 'Plan', 'Date']}
                  minWidth={1260}
                >
                  {paymentHistory.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <strong>{payment.user?.name || 'Unknown user'}</strong>
                        <div className="admin-table__muted">{payment.user?.email || 'N/A'}</div>
                      </td>
                      <td>{payment.amount}</td>
                      <td>{payment.currency}</td>
                      <td><AdminBadge tone={toneForPaymentStatus(payment.status)}>{payment.status}</AdminBadge></td>
                      <td>{payment.paymentMethod || 'N/A'}</td>
                      <td>{payment.transactionId || 'N/A'}</td>
                      <td>{payment.plan?.name || 'N/A'}</td>
                      <td>{formatDate(payment.date)}</td>
                    </tr>
                  ))}
                </AdminTable>

                <AdminPagination
                  page={paymentPagination.page}
                  totalPages={paymentPagination.totalPages}
                  onChange={(page) => setHistoryFilters((prev) => ({ ...prev, page }))}
                />
              </>
            )}
          </section>
        </>
      ) : null}

      {activeTab === 'plans' ? (
        <>
          <div className="admin-stats-grid">
            <AdminStatCard label="Plans" value={planPagination.total} hint="Admin-managed catalog rows" tone="info" />
            <AdminStatCard label="Active" value={planStats.active || 0} hint="Selectable for manual premium grants" tone="success" />
            <AdminStatCard label="Disabled" value={planStats.disabled || 0} hint="Temporarily unavailable" tone="warning" />
            <AdminStatCard label="Archived" value={planStats.archived || 0} hint="Kept only for history" tone="danger" />
            <AdminStatCard label="Live access tiers" value="Pro / Pro+" hint="Existing runtime feature tiers remain unchanged" tone="neutral" />
          </div>

          <section className="admin-panel">
            <div className="admin-toolbar">
              <label className="admin-field admin-field--search">
                <span>Search</span>
                <input
                  value={planFilters.search}
                  onChange={(event) => setPlanFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
                  placeholder="Plan name"
                />
              </label>

              <label className="admin-field">
                <span>Status</span>
                <select value={planFilters.status} onChange={(event) => setPlanFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))}>
                  <option value="">All statuses</option>
                  {PLAN_STATUS_OPTIONS.filter(Boolean).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>

            {plansLoading ? (
              <AdminLoadingState label="Loading subscription plans..." />
            ) : plans.length === 0 ? (
              <AdminEmptyState
                title="No subscription plans yet"
                description="Create the first plan catalog entry for future checkout wiring or manual premium assignment."
                actionLabel="Create plan"
                onAction={openCreatePlanModal}
              />
            ) : (
              <>
                <AdminTable
                  columns={['Plan', 'Price', 'Currency', 'Duration', 'Access tier', 'Features', 'Status', 'Updated', 'Actions']}
                  minWidth={1320}
                >
                  {plans.map((plan) => (
                    <tr key={plan.id}>
                      <td>
                        <strong>{plan.name}</strong>
                        <div className="admin-table__muted">Created {formatDate(plan.createdAt)}</div>
                      </td>
                      <td>{plan.price}</td>
                      <td>{plan.currency}</td>
                      <td>{plan.durationDays} days</td>
                      <td><AdminBadge tone={toneForPremium(plan.accessPlan)}>{plan.accessPlan === 'pro_plus' ? 'Pro+' : 'Pro'}</AdminBadge></td>
                      <td>{plan.features?.length ? plan.features.join(', ') : 'No features listed'}</td>
                      <td><AdminBadge tone={toneForPlanStatus(plan.status)}>{plan.status}</AdminBadge></td>
                      <td>{formatDate(plan.updatedAt)}</td>
                      <td>
                        <div className="admin-table__actions">
                          <AdminActionButton variant="ghost" onClick={() => openEditPlanModal(plan)}>Edit</AdminActionButton>
                          {plan.status !== 'archived' ? (
                            <AdminActionButton
                              variant="ghost"
                              tone={plan.status === 'active' ? 'warning' : 'success'}
                              onClick={() => setPlanAction({
                                type: plan.status === 'active' ? 'disable' : 'activate',
                                planId: plan.id,
                                planName: plan.name
                              })}
                            >
                              {plan.status === 'active' ? 'Disable' : 'Activate'}
                            </AdminActionButton>
                          ) : null}
                          {plan.status !== 'archived' ? (
                            <AdminActionButton
                              variant="ghost"
                              tone="danger"
                              onClick={() => setPlanAction({
                                type: 'archive',
                                planId: plan.id,
                                planName: plan.name
                              })}
                            >
                              Archive
                            </AdminActionButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </AdminTable>

                <AdminPagination
                  page={planPagination.page}
                  totalPages={planPagination.totalPages}
                  onChange={(page) => setPlanFilters((prev) => ({ ...prev, page }))}
                />
              </>
            )}
          </section>
        </>
      ) : null}

      {activeTab === 'premium' ? (
        <div className="admin-panels-grid admin-panels-grid--equal">
          <section className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <h3>Select user</h3>
                <p className="admin-panel__subtext">Search for a specific account before granting or revoking premium access.</p>
              </div>
            </div>

            <label className="admin-field">
              <span>User search</span>
              <input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Name or email"
              />
            </label>

            <div className="admin-history-list">
              {userSearchLoading ? (
                <AdminLoadingState label="Searching users..." />
              ) : userResults.length ? userResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className={`admin-history-item admin-select-card ${selectedUserId === user.id ? 'admin-select-card--active' : ''}`}
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <div>
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <AdminBadge tone="neutral">{user.role || 'user'}</AdminBadge>
                </button>
              )) : (
                <AdminEmptyState
                  compact
                  title="No user selected"
                  description="Search for a user to inspect current premium status and apply a manual plan."
                />
              )}
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <h3>Manual premium access</h3>
                <p className="admin-panel__subtext">Uses the existing `plan` and `planExpiresAt` fields only. Roles and login state are not touched.</p>
              </div>
            </div>

            {selectedUserLoading ? (
              <AdminLoadingState label="Loading user premium status..." />
            ) : !selectedUser ? (
              <AdminEmptyState title="Choose a user first" description="The premium controls unlock after you select a specific account." compact />
            ) : (
              <form
                className="admin-detail-stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!premiumForm.reason.trim()) {
                    toast.error('Reason is required');
                    return;
                  }
                  if (!premiumForm.planId && !premiumForm.expiresAt) {
                    toast.error('Expiry date is required');
                    return;
                  }
                  setPremiumAction({ type: 'grant' });
                }}
              >
                <div>
                  <strong>{selectedUser.name}</strong>
                  <p>{selectedUser.email}</p>
                  <div className="admin-chip-row">
                    <AdminBadge tone={toneForPremium(selectedUser.plan)}>{selectedUser.plan || 'free'}</AdminBadge>
                    <AdminBadge tone={selectedUser.planExpiresAt ? 'info' : 'neutral'}>
                      {selectedUser.planExpiresAt ? `Expires ${formatDate(selectedUser.planExpiresAt)}` : 'No expiry'}
                    </AdminBadge>
                  </div>
                </div>

                <label className="admin-field">
                  <span>Plan catalog entry</span>
                  <select
                    value={premiumForm.planId}
                    onChange={(event) => {
                      const planId = event.target.value;
                      const plan = plans.find((item) => item.id === planId) || null;
                      setPremiumForm((prev) => ({
                        ...prev,
                        planId,
                        accessPlan: plan?.accessPlan || prev.accessPlan
                      }));
                    }}
                  >
                    <option value="">No catalog plan selected</option>
                    {plans.filter((item) => item.status === 'active').map((plan) => (
                      <option key={plan.id} value={plan.id}>{plan.name}</option>
                    ))}
                  </select>
                </label>

                <label className="admin-field">
                  <span>Access tier</span>
                  <select
                    value={premiumForm.accessPlan}
                    onChange={(event) => setPremiumForm((prev) => ({ ...prev, accessPlan: event.target.value }))}
                    disabled={Boolean(premiumForm.planId)}
                  >
                    {ACCESS_PLAN_OPTIONS.map((item) => (
                      <option key={item} value={item}>{item === 'pro_plus' ? 'Pro+' : 'Pro'}</option>
                    ))}
                  </select>
                </label>

                <label className="admin-field">
                  <span>Expiry date</span>
                  <input
                    type="datetime-local"
                    value={premiumForm.expiresAt}
                    onChange={(event) => setPremiumForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
                  />
                </label>

                {premiumForm.planId && !premiumForm.expiresAt ? (
                  <div className="admin-inline-note">
                    Leaving the expiry blank will use the selected plan duration automatically.
                  </div>
                ) : null}

                <label className="admin-field">
                  <span>Reason</span>
                  <textarea
                    rows={4}
                    value={premiumForm.reason}
                    onChange={(event) => setPremiumForm((prev) => ({ ...prev, reason: event.target.value }))}
                    placeholder="Explain why this user is receiving manual premium access."
                  />
                </label>

                {selectedPlan ? (
                  <div className="admin-inline-note">
                    Selected plan: <strong>{selectedPlan.name}</strong> maps to the live <strong>{selectedPlan.accessPlan === 'pro_plus' ? 'Pro+' : 'Pro'}</strong> tier for {selectedPlan.durationDays} days.
                  </div>
                ) : null}

                <div className="admin-action-row">
                  <button type="submit" className="admin-button">Grant premium</button>
                  <AdminActionButton
                    type="button"
                    variant="ghost"
                    tone="danger"
                    onClick={() => {
                      if (!premiumForm.reason.trim()) {
                        toast.error('Reason is required before revoking premium');
                        return;
                      }
                      setPremiumAction({ type: 'revoke' });
                    }}
                  >
                    Revoke premium
                  </AdminActionButton>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}

      {planModalOpen ? (
        <div className="admin-modal-backdrop" onClick={() => setPlanModalOpen(false)}>
          <div className="admin-modal admin-modal--large" onClick={(event) => event.stopPropagation()}>
            <h3>{planForm.id ? 'Edit subscription plan' : 'Create subscription plan'}</h3>
            <p>These plan catalog records are safe for manual premium assignment now and future payment integration later.</p>

            <form onSubmit={handlePlanSubmit}>
              <div className="admin-modal-form-grid">
                <label className="admin-field">
                  <span>Plan name</span>
                  <input value={planForm.name} onChange={(event) => setPlanForm((prev) => ({ ...prev, name: event.target.value }))} />
                </label>

                <label className="admin-field">
                  <span>Price</span>
                  <input type="number" min="0" step="0.01" value={planForm.price} onChange={(event) => setPlanForm((prev) => ({ ...prev, price: event.target.value }))} />
                </label>

                <label className="admin-field">
                  <span>Currency</span>
                  <input value={planForm.currency} onChange={(event) => setPlanForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))} />
                </label>

                <label className="admin-field">
                  <span>Duration in days</span>
                  <input type="number" min="1" value={planForm.durationDays} onChange={(event) => setPlanForm((prev) => ({ ...prev, durationDays: event.target.value }))} />
                </label>

                <label className="admin-field">
                  <span>Access tier</span>
                  <select value={planForm.accessPlan} onChange={(event) => setPlanForm((prev) => ({ ...prev, accessPlan: event.target.value }))}>
                    {ACCESS_PLAN_OPTIONS.map((item) => (
                      <option key={item} value={item}>{item === 'pro_plus' ? 'Pro+' : 'Pro'}</option>
                    ))}
                  </select>
                </label>

                <label className="admin-field">
                  <span>Status</span>
                  <select value={planForm.status} onChange={(event) => setPlanForm((prev) => ({ ...prev, status: event.target.value }))}>
                    <option value="active">active</option>
                    <option value="disabled">disabled</option>
                  </select>
                </label>
              </div>

              <label className="admin-field" style={{ marginTop: 14 }}>
                <span>Features</span>
                <textarea
                  rows={5}
                  value={planForm.featuresText}
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, featuresText: event.target.value }))}
                  placeholder={'One feature per line\nUnlimited mock tests\nPriority support'}
                />
              </label>

              <label className="admin-field" style={{ marginTop: 14 }}>
                <span>Reason for audit log</span>
                <textarea
                  rows={3}
                  value={planForm.reason}
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, reason: event.target.value }))}
                  placeholder="Describe why this plan is being created or updated."
                />
              </label>

              <div className="admin-modal__actions">
                <button type="button" className="admin-button admin-button--ghost" onClick={() => setPlanModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="admin-button" disabled={planSubmitting}>
                  {planSubmitting ? 'Saving...' : planForm.id ? 'Save changes' : 'Create plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <AdminConfirmModal
        open={Boolean(planAction)}
        title={
          planAction?.type === 'archive'
            ? `Archive ${planAction?.planName}?`
            : `${planAction?.type === 'disable' ? 'Disable' : 'Activate'} ${planAction?.planName}?`
        }
        description={
          planAction?.type === 'archive'
            ? 'Archived plans stay in history but can no longer be edited or granted by mistake.'
            : `This will mark the plan as ${planAction?.type === 'disable' ? 'disabled' : 'active'}.`
        }
        requireReason
        reasonLabel="Reason"
        confirmLabel={planAction?.type === 'archive' ? 'Archive plan' : 'Confirm'}
        onClose={() => setPlanAction(null)}
        onConfirm={handlePlanActionConfirm}
      />

      <AdminConfirmModal
        open={Boolean(premiumAction)}
        title={premiumAction?.type === 'grant' ? 'Grant premium access?' : 'Revoke premium access?'}
        description={
          premiumAction?.type === 'grant'
            ? 'This updates only the user premium plan fields and expiry date.'
            : 'This will safely return the user to the free plan.'
        }
        confirmLabel={premiumAction?.type === 'grant' ? 'Grant premium' : 'Revoke premium'}
        onClose={() => setPremiumAction(null)}
        onConfirm={handlePremiumConfirm}
      />
    </section>
  );
}
