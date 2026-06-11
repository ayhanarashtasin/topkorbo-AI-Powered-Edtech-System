const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const highlightController = require('../controllers/highlightController');

// All highlight routes require authentication
router.use(auth);

router.route('/')
  .get(highlightController.getHighlights)
  .post(highlightController.createHighlight);

router.route('/:id')
  .put(highlightController.updateHighlight)
  .delete(highlightController.deleteHighlight);

module.exports = router;
