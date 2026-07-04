const { fetchDashboardStats } = require('../../services/admin/dashboardStatsService');

async function getDashboardStats(req, res, next) {
  try {
    const data = await fetchDashboardStats();
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getDashboardStats
};
