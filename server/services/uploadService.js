const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { cloudinary, isCloudinaryEnabled } = require('../config/cloudinary');

const LOCAL_ROOT = path.resolve(__dirname, '..', 'uploads', 'forum');
if (!fs.existsSync(LOCAL_ROOT)) fs.mkdirSync(LOCAL_ROOT, { recursive: true });

/**
 * Upload a single image buffer.
 * Returns { url, publicId, width, height }
 * Works for both Cloudinary and local-disk fallback.
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

  // Local fallback — write to /uploads/forum/<userId>/<timestamp>-<rand>.<ext>
  const ext = (path.extname(file.originalname || '') || mimeToExt(file.mimetype) || '.jpg')
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '');
  const userDir = path.join(LOCAL_ROOT, String(userId || 'anon'));
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
  const safeName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  const fullPath = path.join(userDir, safeName);
  fs.writeFileSync(fullPath, file.buffer);
  // Public URL — served by app.use('/uploads', ...) in server.js
  const publicUrl = `/uploads/forum/${userId || 'anon'}/${safeName}`;
  return { url: publicUrl, publicId: safeName, width: null, height: null };
}

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
 * Delete a previously uploaded image (best-effort, swallows errors).
 */
async function deleteImage(publicId, localUrl) {
  if (isCloudinaryEnabled && publicId && !publicId.includes('/')) {
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