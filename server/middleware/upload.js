const path = require('path');
const fs = require('fs');
const multer = require('multer');

const MAX_PDF_UPLOAD_MB = 500;
const MAX_PDF_UPLOAD_BYTES = MAX_PDF_UPLOAD_MB * 1024 * 1024;
const uploadTempDir = path.resolve(__dirname, '..', 'tmp', 'uploads', 'books');

// Store large PDFs on disk temporarily so uploads don't require huge memory buffers.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(uploadTempDir, { recursive: true });
    cb(null, uploadTempDir);
  },
  filename: (req, file, cb) => {
    const safeName = (file.originalname || 'file.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (file.mimetype === 'application/pdf' || ext === '.pdf') return cb(null, true);
  cb(new Error('Only PDF files are allowed'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_PDF_UPLOAD_BYTES }
});

upload.MAX_PDF_UPLOAD_MB = MAX_PDF_UPLOAD_MB;

module.exports = upload;
