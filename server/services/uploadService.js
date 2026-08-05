/**
 * Image upload service with dual storage backends.
 *
 * When Cloudinary credentials are configured, images are uploaded there
 * (auto-optimized, globally distributed). Otherwise, files are written to a
 * local /uploads/forum directory served as static assets. On Vercel or other
 * serverless platforms without persistent disk, Cloudinary is required — the
 * service throws a 503 if it's missing.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { cloudinary, isCloudinaryEnabled } = require('../config/cloudinary');

// Local disk root for forum image storage (relative to server root)
const LOCAL_ROOT = path.resolve(__dirname, '..', 'uploads', 'forum');

// Vercel and similar platforms have ephemeral filesystems — local storage won't persist
const requiresExternalStorage =
  Boolean(process.env.VERCEL) ||
  process.env.REQUIRE_EXTERNAL_IMAGE_STORAGE === 'true';

/**
 * Upload a single image buffer to the best available storage backend.
 *
 * Returns { url, publicId, width, height } where width/height are null for local
 * storage (no server-side resizing). The file's detectedMime/detectedExt (set by
 * verifyImageBytes middleware) determine the extension — we never use the client
 * filename to avoid path traversal or extension spoofing.
 */
async function uploadImage(file, userId, folder = 'topkorbo/forum') {
  if (!file || !file.buffer) {
    throw new Error('uploadImage: no buffer provided');
  }

  if (isCloudinaryEnabled) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          // Limit to 1600px max dimension, auto quality for bandwidth savings
          transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto' }]
        },
        (err, result) => {
          if (err) return reject(err);
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height
          });
        }
      );
      stream.end(file.buffer);
    });
  }

  // Serverless platforms have no persistent disk — reject if Cloudinary isn't configured
  if (requiresExternalStorage) {
    const error = new Error(
      'Forum image storage is not configured. Set the Cloudinary environment variables.'
    );
    error.statusCode = 503;
    throw error;
  }

  // Local fallback: write to /uploads/forum/<userId>/<timestamp>-<rand>.<ext>
  const ext = (file.detectedExt || mimeToExt(file.detectedMime) || mimeToExt(file.mimetype) || '.jpg')
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '');
  const userDir = path.join(LOCAL_ROOT, String(userId || 'anon'));
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
  // Timestamp + random hex ensures uniqueness and prevents overwrites
  const safeName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  const fullPath = path.join(userDir, safeName);
  fs.writeFileSync(fullPath, file.buffer);
  // Public URL served by app.use('/uploads', ...) in server.js
  const publicUrl = `/uploads/forum/${userId || 'anon'}/${safeName}`;
  return { url: publicUrl, publicId: safeName, width: null, height: null };
}

/** Map a MIME type string to its canonical file extension. */
function mimeToExt(mime) {
  if (!mime) return null;
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return '.jpg';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/svg+xml') return '.svg';
  return null;
}

/**
 * Delete a previously uploaded image (best-effort, never throws).
 *
 * Cloudinary: uses the publicId to remove the asset.
 * Local: converts the public URL path back to an absolute filesystem path and unlinks.
 */
async function deleteImage(publicId, localUrl) {
  if (isCloudinaryEnabled && publicId) {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (e) {
      console.warn('Cloudinary delete failed:', e.message);
    }
    return;
  }
  // Local: convert /uploads/forum/<uid>/<file> to filesystem path
  if (localUrl && localUrl.startsWith('/uploads/forum/')) {
    const relative = localUrl.replace(/^\//, '');
    const full = path.resolve(__dirname, '..', relative);
    if (fs.existsSync(full)) {
      try {
        fs.unlinkSync(full);
      } catch (e) {
        console.warn('Local delete failed:', e.message);
      }
    }
  }
}

module.exports = { uploadImage, deleteImage, isCloudinaryEnabled };
