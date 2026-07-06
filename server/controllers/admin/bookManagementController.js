const adminBookService = require('../../services/admin/adminBookService');

async function listBooks(req, res, next) {
  try {
    const data = await adminBookService.listBooksForApproval(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getBookDetails(req, res, next) {
  try {
    const data = await adminBookService.getBookApprovalDetails(req.params.bookId);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function approveBook(req, res, next) {
  try {
    const data = await adminBookService.approveBook({
      adminUser: req.user,
      bookId: req.params.bookId,
      reason: req.body?.reason || ''
    });
    return res.json({ success: true, data, message: 'Book approved successfully' });
  } catch (err) {
    return next(err);
  }
}

async function rejectBook(req, res, next) {
  try {
    const data = await adminBookService.rejectBook({
      adminUser: req.user,
      bookId: req.params.bookId,
      reason: req.body?.reason || ''
    });
    return res.json({ success: true, data, message: 'Book rejected successfully' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listBooks,
  getBookDetails,
  approveBook,
  rejectBook
};
