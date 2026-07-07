const { fetchOverviewAnalytics } = require('../../services/admin/adminAnalyticsService');

async function getOverview(req, res, next) {
  try {
    const data = await fetchOverviewAnalytics({ range: req.query?.range || '30d' });
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getOverview
};
