const PlatformSetting = require('../../models/PlatformSetting');
const { createAdminAuditLog } = require('./adminAuditService');

const PLATFORM_SETTINGS_KEY = 'platform';

function getDefaultSettings() {
  return {
    academicYear: '',
    registrationEnabled: true,
    maintenanceMode: {
      enabled: false,
      message: ''
    }
  };
}

async function getSettingsDocument() {
  let settings = await PlatformSetting.findOne({ key: PLATFORM_SETTINGS_KEY });
  if (!settings) {
    settings = await PlatformSetting.create({
      key: PLATFORM_SETTINGS_KEY,
      ...getDefaultSettings()
    });
  }
  return settings;
}

function serializeSettings(settings) {
  return {
    id: String(settings._id),
    academicYear: settings.academicYear || '',
    registrationEnabled: settings.registrationEnabled !== false,
    maintenanceMode: {
      enabled: Boolean(settings.maintenanceMode?.enabled),
      message: settings.maintenanceMode?.message || ''
    },
    featureToggles: {
      registrationEnabled: settings.registrationEnabled !== false
    },
    updatedAt: settings.updatedAt || settings.createdAt || null
  };
}

function validateAcademicYear(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.length > 32) {
    const err = new Error('Academic year must be 32 characters or fewer');
    err.statusCode = 400;
    throw err;
  }
  return normalized;
}

function validateBoolean(value, label) {
  if (typeof value !== 'boolean') {
    const err = new Error(`${label} must be true or false`);
    err.statusCode = 400;
    throw err;
  }
  return value;
}

function validateMaintenanceMode(input = {}) {
  if (typeof input.enabled !== 'boolean') {
    const err = new Error('Maintenance mode must be true or false');
    err.statusCode = 400;
    throw err;
  }
  const enabled = input.enabled;
  const message = String(input.message || '').trim();
  if (message.length > 240) {
    const err = new Error('Maintenance message must be 240 characters or fewer');
    err.statusCode = 400;
    throw err;
  }
  return { enabled, message };
}

async function getPlatformSettings() {
  const settings = await getSettingsDocument();
  return serializeSettings(settings);
}

async function updatePlatformSettings({ adminUser, payload = {} }) {
  const settings = await getSettingsDocument();
  const previous = serializeSettings(settings);
  let changed = false;

  if (Object.prototype.hasOwnProperty.call(payload, 'academicYear')) {
    settings.academicYear = validateAcademicYear(payload.academicYear);
    changed = true;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'registrationEnabled')) {
    settings.registrationEnabled = validateBoolean(payload.registrationEnabled, 'Registration setting');
    changed = true;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'maintenanceMode')) {
    settings.maintenanceMode = validateMaintenanceMode(payload.maintenanceMode || {});
    changed = true;
  }

  if (!changed) {
    const err = new Error('No settings changes were provided');
    err.statusCode = 400;
    throw err;
  }

  await settings.save();
  const current = serializeSettings(settings);

  if (previous.academicYear !== current.academicYear) {
    await createAdminAuditLog({
      adminId: adminUser.id,
      actionType: 'SETTINGS_UPDATED',
      targetEntityId: current.id,
      targetEntityType: 'platform_settings',
      targetEntityName: 'Platform settings',
      previousValue: { academicYear: previous.academicYear },
      newValue: { academicYear: current.academicYear },
      reason: String(payload.reason || '').trim()
    });
  }

  if (previous.registrationEnabled !== current.registrationEnabled) {
    await createAdminAuditLog({
      adminId: adminUser.id,
      actionType: 'FEATURE_TOGGLE_UPDATED',
      targetEntityId: current.id,
      targetEntityType: 'platform_settings',
      targetEntityName: 'Registration toggle',
      previousValue: { registrationEnabled: previous.registrationEnabled },
      newValue: { registrationEnabled: current.registrationEnabled },
      reason: String(payload.reason || '').trim()
    });
  }

  if (
    previous.maintenanceMode.enabled !== current.maintenanceMode.enabled
    || previous.maintenanceMode.message !== current.maintenanceMode.message
  ) {
    await createAdminAuditLog({
      adminId: adminUser.id,
      actionType: 'MAINTENANCE_MODE_UPDATED',
      targetEntityId: current.id,
      targetEntityType: 'platform_settings',
      targetEntityName: 'Maintenance mode',
      previousValue: previous.maintenanceMode,
      newValue: current.maintenanceMode,
      reason: String(payload.reason || '').trim()
    });
  }

  return current;
}

module.exports = {
  getPlatformSettings,
  updatePlatformSettings,
  getSettingsDocument,
  serializeSettings
};
