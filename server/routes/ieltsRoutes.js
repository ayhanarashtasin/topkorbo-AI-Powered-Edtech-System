/**
 * IELTS Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * REST endpoints for IELTS Listening, Reading, Writing, Speaking appointment
 * scheduling, and AI evaluation.
 *
 * Route pattern: Auth/Upload Middleware ➔ IELTS Controller Methods.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const auth = require('../middleware/auth');
const ieltsController = require('../controllers/ieltsController');

const router = express.Router();

// Multer storage configuration for IELTS audio, PDF, and image uploads
const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads', 'ielts');
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user && req.user.id ? String(req.user.id) : 'anonymous';
    const dir = path.join(UPLOAD_ROOT, userId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const nameWithoutExt = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${nameWithoutExt}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.pdf', '.mp3', '.wav', '.ogg', '.m4a', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
  if (
    allowedExts.includes(ext) ||
    file.mimetype.startsWith('audio/') ||
    file.mimetype === 'application/pdf' ||
    file.mimetype.startsWith('image/')
  ) {
    return cb(null, true);
  }
  cb(new Error('Only PDF, Audio, and Image files (.pdf, .mp3, .wav, .ogg, .m4a, .png, .jpg, .jpeg, .webp, .gif) are allowed.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limit
});

// ── Listening Sets ──
router.post('/listening/upload', auth, upload.any(), ieltsController.uploadListeningSet);
router.get('/listening/sets', auth, ieltsController.getListeningSets);

// ── Teachers & Speaking Appointments ──
router.get('/teachers', auth, ieltsController.getApprovedTeachers);
router.post('/appointments', auth, ieltsController.createAppointment);
router.get('/appointments', auth, ieltsController.getAppointments);
router.patch('/appointments/:appointmentId/status', auth, ieltsController.updateAppointmentStatus);

// ── Writing Sets & AI Evaluation ──
router.post('/writing/upload', auth, upload.any(), ieltsController.uploadWritingSet);
router.get('/writing/sets', auth, ieltsController.getWritingSets);
router.delete('/writing/sets/:id', auth, ieltsController.deleteWritingSet);
router.post('/writing/evaluate', auth, ieltsController.evaluateWriting);

// ── Reading Sets ──
router.post('/reading/upload', auth, upload.any(), ieltsController.uploadReadingSet);
router.get('/reading/sets', auth, ieltsController.getReadingSets);

module.exports = router;
