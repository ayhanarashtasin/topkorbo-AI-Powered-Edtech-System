const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requirePlan = require('../middleware/requirePlan');
const highlightController = require('../controllers/highlightController');
const { annotationWriteLimiter } = require('../middleware/rateLimiters');

// All highlight routes require authentication
router.use(auth);

router.route('/')
  .get(highlightController.getHighlights)
  // Creating a highlight note is a Pro+ reading tool.
  .post(annotationWriteLimiter, requirePlan('pro_plus'), highlightController.createHighlight);

router.route('/:id')
  .put(annotationWriteLimiter, requirePlan('pro_plus'), highlightController.updateHighlight)
  .delete(annotationWriteLimiter, highlightController.deleteHighlight);

module.exports = router;
