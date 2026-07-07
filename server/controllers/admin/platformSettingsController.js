const adminPlatformSettingsService = require('../../services/admin/adminPlatformSettingsService');

async function getPlatformSettings(req, res, next) {
  try {
    const data = await adminPlatformSettingsService.getPlatformSettings();
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function updatePlatformSettings(req, res, next) {
  try {
    const data = await adminPlatformSettingsService.updatePlatformSettings({
      adminUser: req.user,
      payload: req.body || {}
    });
    return res.json({ success: true, data, message: 'Platform settings updated successfully.' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getPlatformSettings,
  updatePlatformSettings
};
