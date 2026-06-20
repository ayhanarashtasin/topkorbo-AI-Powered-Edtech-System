const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads', 'books');
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user && req.user.id ? String(req.user.id) : 'anonymous';
    const dir = path.join(UPLOAD_ROOT, userId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = (file.originalname || 'file.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (file.mimetype === 'application/pdf' || ext === '.pdf') return cb(null, true);
  cb(new Error('Only PDF files are allowed'));
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 30 * 1024 * 1024 } // 30 MB
});
