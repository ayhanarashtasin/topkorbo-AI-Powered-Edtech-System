const adminWaitlistService = require('../../services/admin/adminWaitlistService');

async function listWaitlistEntries(req, res, next) {
  try {
    const data = await adminWaitlistService.listWaitlistEntries(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function exportWaitlistEntries(req, res, next) {
  try {
    const csv = await adminWaitlistService.exportWaitlistEntries({
      adminUser: req.user,
      search: req.query.search || '',
      contacted: req.query.contacted || '',
      targetExam: req.query.targetExam || ''
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="waitlist-export.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    return next(err);
  }
}

async function markWaitlistContacted(req, res, next) {
  try {
    const data = await adminWaitlistService.markWaitlistContacted({
      adminUser: req.user,
      entryId: req.params.entryId,
      contacted: req.body?.contacted
    });
    return res.json({ success: true, data, message: 'Waitlist contact status updated successfully' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listWaitlistEntries,
  exportWaitlistEntries,
  markWaitlistContacted
};
