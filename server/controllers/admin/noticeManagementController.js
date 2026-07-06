const adminNoticeService = require('../../services/admin/adminNoticeService');

async function listNotices(req, res, next) {
  try {
    const data = await adminNoticeService.listNotices(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function createNotice(req, res, next) {
  try {
    const data = await adminNoticeService.createNotice({
      adminUser: req.user,
      payload: req.body || {}
    });
    return res.status(201).json({ success: true, data, message: 'Notice created successfully' });
  } catch (err) {
    return next(err);
  }
}

async function updateNotice(req, res, next) {
  try {
    const data = await adminNoticeService.updateNotice({
      adminUser: req.user,
      noticeId: req.params.noticeId,
      payload: req.body || {}
    });
    return res.json({ success: true, data, message: 'Notice updated successfully' });
  } catch (err) {
    return next(err);
  }
}

async function archiveNotice(req, res, next) {
  try {
    const data = await adminNoticeService.archiveNotice({
      adminUser: req.user,
      noticeId: req.params.noticeId
    });
    return res.json({ success: true, data, message: 'Notice archived successfully' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listNotices,
  createNotice,
  updateNotice,
  archiveNotice
};
