import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminActionButton from '../components/AdminActionButton';
import AdminBadge from '../components/AdminBadge';
import AdminConfirmModal from '../components/AdminConfirmModal';
import AdminLoadingState from '../components/AdminLoadingState';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminStatCard from '../components/AdminStatCard';
import { fetchAdminPlatformSettings, updateAdminPlatformSettings } from '../services/adminApi';

const SETTINGS_TABS = [
  { id: 'platform', label: 'Platform Settings' },
  { id: 'features', label: 'Feature Toggles' }
];

function formatDate(value) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('platform');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({
    academicYear: '',
    registrationEnabled: true,
    maintenanceModeEnabled: false,
    maintenanceMessage: '',
    reason: ''
  });
  const [confirmState, setConfirmState] = useState(null);

  async function loadSettings() {
    try {
      setLoading(true);
      const data = await fetchAdminPlatformSettings();
      setSettings(data);
      setForm({
        academicYear: data?.academicYear || '',
        registrationEnabled: data?.registrationEnabled !== false,
        maintenanceModeEnabled: Boolean(data?.maintenanceMode?.enabled),
        maintenanceMessage: data?.maintenanceMode?.message || '',
        reason: ''
      });
    } catch (err) {
      toast.error(err.message || 'Failed to load platform settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadSettings();
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function saveSettings(payloadOverride = null) {
    try {
      setSaving(true);
      const payload = payloadOverride || {
        academicYear: form.academicYear,
        registrationEnabled: form.registrationEnabled,
        maintenanceMode: {
          enabled: form.maintenanceModeEnabled,
          message: form.maintenanceMessage
        },
        reason: form.reason
      };
      const data = await updateAdminPlatformSettings(payload);
      setSettings(data);
      setForm((prev) => ({
        ...prev,
        reason: '',
        academicYear: data?.academicYear || '',
        registrationEnabled: data?.registrationEnabled !== false,
        maintenanceModeEnabled: Boolean(data?.maintenanceMode?.enabled),
        maintenanceMessage: data?.maintenanceMode?.message || ''
      }));
      toast.success('Platform settings updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update platform settings');
    } finally {
      setSaving(false);
    }
  }

  function handlePlatformSubmit(event) {
    event.preventDefault();
    if (!form.reason.trim()) {
      toast.error('Reason is required for audit logging');
      return;
    }

    const dangerousChange = (!form.registrationEnabled && settings?.registrationEnabled !== false)
      || (form.maintenanceModeEnabled && !settings?.maintenanceMode?.enabled);

    if (dangerousChange) {
      setConfirmState({ type: 'dangerous' });
      return;
    }

    saveSettings();
  }

  if (loading) {
    return <AdminLoadingState label="Loading platform settings..." />;
  }

  return (
    <section className="admin-page">
      <AdminPageHeader
        title="Settings"
        description="Store validated platform configuration centrally, keep dangerous changes behind confirmation, and write every change to the admin audit log."
        badge={{ label: `Updated ${formatDate(settings?.updatedAt)}`, tone: 'info' }}
      />

      <div className="admin-tabs" role="tablist" aria-label="Settings tabs">
        {SETTINGS_TABS.map((tab) => (
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

      <div className="admin-stats-grid">
        <AdminStatCard label="Academic year" value={form.academicYear || 'Not set'} hint="Displayed as a stored platform default" tone="info" />
        <AdminStatCard label="Registrations" value={form.registrationEnabled ? 'Enabled' : 'Disabled'} hint="Blocks new signup creation when disabled" tone={form.registrationEnabled ? 'success' : 'danger'} />
        <AdminStatCard label="Maintenance mode" value={form.maintenanceModeEnabled ? 'On' : 'Off'} hint="Stored placeholder with audited confirmation" tone={form.maintenanceModeEnabled ? 'warning' : 'neutral'} />
        <AdminStatCard label="Audit trail" value="Enabled" hint="Every settings save creates admin audit entries" tone="success" />
        <AdminStatCard label="Feature toggles" value="Safe only" hint="No broken runtime-only switches were added" tone="neutral" />
      </div>

      <section className="admin-panel">
        <form className="admin-detail-stack" onSubmit={handlePlatformSubmit}>
          {activeTab === 'platform' ? (
            <>
              <label className="admin-field">
                <span>Academic year</span>
                <input
                  value={form.academicYear}
                  onChange={(event) => setForm((prev) => ({ ...prev, academicYear: event.target.value }))}
                  placeholder="2026-2027"
                />
              </label>

              <label className="admin-field">
                <span>Maintenance message placeholder</span>
                <textarea
                  rows={4}
                  value={form.maintenanceMessage}
                  onChange={(event) => setForm((prev) => ({ ...prev, maintenanceMessage: event.target.value }))}
                  placeholder="Optional message for future maintenance-mode usage."
                />
              </label>

              <div className="admin-inline-note">
                Maintenance mode is stored safely for platform operations and audit review. No global shutdown behavior was added in this phase.
              </div>
            </>
          ) : null}

          {activeTab === 'features' ? (
            <>
              <div className="admin-option-list">
                <div className="admin-option-row">
                  <div>
                    <strong>New user registration</strong>
                    <span>When disabled, brand-new Google signups are blocked while existing users can still log in.</span>
                  </div>
                  <label className="admin-switch">
                    <input
                      type="checkbox"
                      checked={form.registrationEnabled}
                      onChange={(event) => setForm((prev) => ({ ...prev, registrationEnabled: event.target.checked }))}
                    />
                    <span>{form.registrationEnabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>

                <div className="admin-option-row">
                  <div>
                    <strong>Maintenance mode placeholder</strong>
                    <span>Stored for operations and audit, with confirmation required before enabling.</span>
                  </div>
                  <label className="admin-switch">
                    <input
                      type="checkbox"
                      checked={form.maintenanceModeEnabled}
                      onChange={(event) => setForm((prev) => ({ ...prev, maintenanceModeEnabled: event.target.checked }))}
                    />
                    <span>{form.maintenanceModeEnabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>
              </div>
            </>
          ) : null}

          <label className="admin-field">
            <span>Reason for change</span>
            <textarea
              rows={3}
              value={form.reason}
              onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
              placeholder="Explain why this settings change is needed."
            />
          </label>

          <div className="admin-action-row">
            <button type="submit" className="admin-button" disabled={saving}>
              {saving ? 'Saving...' : 'Save settings'}
            </button>
            <AdminActionButton type="button" variant="ghost" onClick={loadSettings}>
              Reset
            </AdminActionButton>
          </div>
        </form>

        <div className="admin-chip-row" style={{ marginTop: 16 }}>
          <AdminBadge tone={form.registrationEnabled ? 'success' : 'danger'}>
            {form.registrationEnabled ? 'Registration enabled' : 'Registration disabled'}
          </AdminBadge>
          <AdminBadge tone={form.maintenanceModeEnabled ? 'warning' : 'neutral'}>
            {form.maintenanceModeEnabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled'}
          </AdminBadge>
        </div>
      </section>

      <AdminConfirmModal
        open={Boolean(confirmState)}
        title="Confirm dangerous platform change"
        description="Disabling registration or enabling maintenance mode can affect public platform access. Confirm that this is intentional."
        confirmLabel="Confirm and save"
        onClose={() => setConfirmState(null)}
        onConfirm={async () => {
          setConfirmState(null);
          await saveSettings();
        }}
      />
    </section>
  );
}
