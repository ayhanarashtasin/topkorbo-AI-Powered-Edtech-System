const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const studyRoutineController = require('../controllers/studyRoutineController');
const aiController = require('../controllers/aiController');

router.use(auth);

router.get('/', studyRoutineController.getRoutine);
router.get('/stats', studyRoutineController.getStats);
router.post('/', studyRoutineController.saveRoutine);
router.patch('/segment', studyRoutineController.toggleSegment);
router.patch('/segment/edit', studyRoutineController.updateSegment);
router.put('/replace', studyRoutineController.replaceRoutine);
router.post('/modify', aiController.modifyStudyRoutine);
router.delete('/', studyRoutineController.deleteRoutine);

// Phase 2 focus-mode session endpoints
router.post('/session/start', studyRoutineController.startSession);
router.post('/session/stop', studyRoutineController.stopSession);

module.exports = router;