/**
 * Practice Routes
 * ----------------------------------------------------------------------------
 * Mounted at /api/practice in server.js. All endpoints require auth.
 *
 *   POST   /              → submit a new attempt
 *   GET    /              → list caller's attempts
 *   GET    /stats/summary → aggregate stats
 *   GET    /dashboard-activity → compact daily solved counts for dashboard
 *   GET    /:id           → fetch one attempt
 *   PATCH  /:id/notes     → update post-submission notes
 *   DELETE /:id           → soft-delete the caller's attempt
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/practiceAttemptController');

router.use(auth);

// Stats must be declared BEFORE the `/:id` route so it isn't shadowed
router.get('/stats/summary', ctrl.getStats);
router.get('/dashboard-activity', ctrl.getDashboardActivity);

router.post('/', ctrl.submitAttempt);
router.get('/', ctrl.listMyAttempts);
router.get('/:id', ctrl.getAttempt);
router.patch('/:id/notes', ctrl.updateNotes);
router.delete('/:id', ctrl.deleteAttempt);

module.exports = router;
