const multer = require('multer');
const { detectImage } = require('../utils/imageSignature');

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const MAX_FORUM_IMAGE_MB = 4;
const MAX_FORUM_IMAGE_BYTES = MAX_FORUM_IMAGE_MB * 1024 * 1024;
const MAX_FORUM_REQUEST_BYTES = 4 * 1024 * 1024;

const REQUEST_BYTES = Symbol('forumUploadBytes');

/**
 * Multer's memoryStorage enforces fileSize per file, so eight concurrent files
 * could be buffered before the old aggregate check ran. This storage engine
 * accounts for chunks as they arrive and aborts as soon as the request-wide
 * budget is exceeded.
 */
function boundedMemoryStorage(maxRequestBytes) {
  return {
    _handleFile(req, file, cb) {
      const chunks = [];
      let size = 0;
      let finished = false;

      const fail = (error) => {
        if (finished) return;
        finished = true;
        chunks.length = 0;
        file.stream.resume();
        cb(error);
      };

      file.stream.on('data', (chunk) => {
        if (finished) return;
        size += chunk.length;
        req[REQUEST_BYTES] = (req[REQUEST_BYTES] || 0) + chunk.length;
        if (req[REQUEST_BYTES] > maxRequestBytes) {
          const error = new Error('Combined upload is too large.');
          error.code = 'LIMIT_TOTAL_FILE_SIZE';
          error.statusCode = 413;
          fail(error);
          return;
        }
        chunks.push(chunk);
      });
      file.stream.once('limit', () => {
        const error = new multer.MulterError('LIMIT_FILE_SIZE', file.fieldname);
        error.statusCode = 413;
        fail(error);
      });
      file.stream.once('error', fail);
      file.stream.once('end', () => {
        if (finished) return;
        finished = true;
        cb(null, { buffer: Buffer.concat(chunks, size), size });
      });
    },
    _removeFile(_req, file, cb) {
      delete file.buffer;
      cb(null);
    }
  };
}

function fileFilter(req, file, cb) {
  // First-pass filter on the declared mimetype; the authoritative check is the
  // magic-byte validation below (verifyImageBytes), which runs after multer has
  // buffered the file and can inspect the real content.
  if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
  const error = new Error('Only PNG, JPEG, GIF, or WebP images are allowed.');
  error.statusCode = 400;
  cb(error);
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

  const totalBytes = files.reduce(
    (sum, file) => sum + (file.size || file.buffer?.length || 0),
    0
  );
  if (totalBytes > MAX_FORUM_REQUEST_BYTES) {
    return res.status(413).json({
      success: false,
      message: `Forum images must be ${MAX_FORUM_IMAGE_MB}MB or less in total.`
    });
  }
  next();
}

const postUpload = multer({
  storage: boundedMemoryStorage(MAX_FORUM_REQUEST_BYTES),
  fileFilter,
  limits: {
    fileSize: MAX_FORUM_IMAGE_BYTES,
    files: 8,
    fields: 7,
    fieldSize: 64 * 1024,
    parts: 15
  }
});

const commentUpload = multer({
  storage: boundedMemoryStorage(MAX_FORUM_REQUEST_BYTES),
  fileFilter,
  limits: {
    fileSize: MAX_FORUM_IMAGE_BYTES,
    files: 3,
    fields: 2,
    fieldSize: 16 * 1024,
    parts: 5
  }
});

const avatarUpload = multer({
  storage: boundedMemoryStorage(2 * 1024 * 1024),
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
    fields: 10,
    fieldSize: 8 * 1024,
    parts: 11
  }
});

module.exports = {
  postUpload,
  commentUpload,
  avatarUpload,
  verifyImageBytes,
  MAX_FORUM_IMAGE_MB,
  MAX_FORUM_REQUEST_BYTES,
  boundedMemoryStorage
};
