/**
 * Forum image upload middleware using Multer.
 *
 * Provides three upload configurations (post, comment, avatar) with different
 * file/field limits. Uses bounded memory storage to enforce a request-wide
 * byte budget instead of per-file limits, preventing abuse from many small files.
 * After multer buffers the files, verifyImageBytes checks magic bytes to reject
 * spoofed uploads (e.g., a .exe renamed to .png).
 */

const multer = require('multer');
const { detectImage } = require('../utils/imageSignature');

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const MAX_FORUM_IMAGE_MB = 4;
const MAX_FORUM_IMAGE_BYTES = MAX_FORUM_IMAGE_MB * 1024 * 1024;
// Aggregate budget across all files in a single request (prevents multi-file bypass)
const MAX_FORUM_REQUEST_BYTES = 4 * 1024 * 1024;

// Symbol to track per-request byte usage across multiple file streams
const REQUEST_BYTES = Symbol('forumUploadBytes');

/**
 * Custom memory storage that enforces a total request-wide byte limit.
 *
 * Multer's built-in memoryStorage only enforces `fileSize` per individual file.
 * With e.g. 8 concurrent uploads, a client could buffer 8× the intended limit
 * before the aggregate check runs. This engine tracks bytes as chunks arrive and
 * aborts immediately when the combined budget is exceeded.
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

/**
 * First-pass filter on the client-declared MIME type.
 *
 * This is a cheap, early rejection before buffering starts. The real validation
 * happens in verifyImageBytes after the file content is in memory — the client
 * can trivially set any MIME header, so we never trust it alone.
 */
function fileFilter(req, file, cb) {
  if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
  const error = new Error('Only PNG, JPEG, GIF, or WebP images are allowed.');
  error.statusCode = 400;
  cb(error);
}

/**
 * Post-multer middleware: verify every buffered file is a real image via magic
 * bytes, then stamp the detected MIME/extension onto the file object so the
 * storage layer never trusts client-supplied filenames or types.
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

// --- Upload configurations for different forum actions ---

// Posts allow up to 8 images with generous field limits for title/content
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

// Comments allow up to 3 images with smaller fields (shorter text)
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

// Avatar is a single 2MB image upload
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
