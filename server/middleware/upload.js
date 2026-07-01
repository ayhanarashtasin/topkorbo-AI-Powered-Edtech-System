const path = require('path');
const multer = require('multer');

// Store files in memory so they can be immediately uploaded to Firebase Storage
const storage = multer.memoryStorage();

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
