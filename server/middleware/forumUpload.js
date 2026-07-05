const multer = require('multer');
const { detectImage } = require('../utils/imageSignature');

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  // First-pass filter on the declared mimetype; the authoritative check is the
  // magic-byte validation below (verifyImageBytes), which runs after multer has
  // buffered the file and can inspect the real content.
  if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only PNG, JPEG, GIF, or WebP images are allowed.'));
}

/**
 * Post-multer middleware: verify every buffered file is a real image by its
 * magic bytes and stamp the detected mime/ext onto the file object so the
 * storage layer never trusts the client filename/mimetype.
 */
function verifyImageBytes(req, res, next) {
  const files = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) files.push(...req.files);
  else if (req.files && typeof req.files === 'object') {
    Object.values(req.files).forEach((arr) => Array.isArray(arr) && files.push(...arr));
  }

  for (const f of files) {
    const detected = detectImage(f.buffer);
    if (!detected) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or unsupported image file. Only real PNG, JPEG, GIF, or WebP images are allowed.'
      });
    }
    f.detectedMime = detected.mime;
    f.detectedExt = detected.ext;
  }
  next();
}

const postUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 8 }
});

const commentUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 3 }
});

const avatarUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 }
});

module.exports = { postUpload, commentUpload, avatarUpload, verifyImageBytes };