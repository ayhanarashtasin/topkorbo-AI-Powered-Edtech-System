const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const auth = require('../middleware/auth');
const IeltsListeningSet = require('../models/IeltsListeningSet');

// Configure Multer storage for IELTS audio and pdfs
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
  const allowedExts = ['.pdf', '.mp3', '.wav', '.ogg', '.m4a'];
  if (allowedExts.includes(ext) || file.mimetype.startsWith('audio/') || file.mimetype === 'application/pdf') {
    return cb(null, true);
  }
  cb(new Error('Only PDF and Audio files (.mp3, .wav, .ogg, .m4a) are allowed.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limits
});

// Helper response formatter
const errorResponse = (res, message, status = 400) => {
  return res.status(status).json({ success: false, message });
};

// POST Upload IELTS Listening set
router.post('/listening/upload', auth, upload.any(), async (req, res) => {
  try {
    // 1. Authorize
    if (req.user.role !== 'teacher') {
      return errorResponse(res, 'Access denied. Only teachers can upload IELTS question sets.', 403);
    }

    const { setName } = req.body;
    if (!setName || !setName.trim()) {
      return errorResponse(res, 'Please provide a name for the question set.');
    }

    // 2. Validate and group uploaded files
    const files = req.files || [];
    const sectionsMap = {
      1: { audioUrl: '', pdfUrl: '' },
      2: { audioUrl: '', pdfUrl: '' },
      3: { audioUrl: '', pdfUrl: '' },
      4: { audioUrl: '', pdfUrl: '' }
    };

    const userId = req.user.id;

    files.forEach(file => {
      // Fieldname format: "section[1-4]_audio" or "section[1-4]_pdf"
      const match = file.fieldname.match(/^section([1-4])_(audio|pdf)$/);
      if (match) {
        const secNum = parseInt(match[1]);
        const fileType = match[2]; // 'audio' or 'pdf'
        // HTTP URL format: /uploads/ielts/:userId/:filename
        const fileUrl = `/uploads/ielts/${userId}/${file.filename}`;
        
        if (fileType === 'audio') {
          sectionsMap[secNum].audioUrl = fileUrl;
        } else if (fileType === 'pdf') {
          sectionsMap[secNum].pdfUrl = fileUrl;
        }
      }
    });

    // 3. Ensure all 4 sections are complete (both files present for each)
    const missing = [];
    for (let sec = 1; sec <= 4; sec++) {
      if (!sectionsMap[sec].audioUrl) {
        missing.push(`Section ${sec} Audio`);
      }
      if (!sectionsMap[sec].pdfUrl) {
        missing.push(`Section ${sec} PDF`);
      }
    }

    if (missing.length > 0) {
      // Clean up uploaded files in case of failure
      files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.error('Error deleting uploaded file on validation failure:', err);
        }
      });
      return errorResponse(res, `Upload incomplete. Missing files: ${missing.join(', ')}`);
    }

    // 4. Save to Database
    const sectionsArray = [];
    for (let sec = 1; sec <= 4; sec++) {
      sectionsArray.push({
        sectionNumber: sec,
        audioUrl: sectionsMap[sec].audioUrl,
        pdfUrl: sectionsMap[sec].pdfUrl
      });
    }

    const newSet = new IeltsListeningSet({
      creator: userId,
      setName: setName.trim(),
      sections: sectionsArray
    });

    await newSet.save();

    res.status(201).json({
      success: true,
      message: 'IELTS Listening question set uploaded and stored successfully!',
      data: newSet
    });

  } catch (err) {
    console.error('Error in IELTS Listening upload route:', err);
    res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

// GET Fetch all uploaded sets (for verification or display)
router.get('/listening/sets', auth, async (req, res) => {
  try {
    const sets = await IeltsListeningSet.find()
      .populate('creator', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: sets });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

module.exports = router;
