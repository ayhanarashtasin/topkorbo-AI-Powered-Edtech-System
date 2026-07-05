/**
 * Magic-byte (content) detection for uploaded images.
 *
 * multer's `fileFilter` only sees the client-supplied `file.mimetype`, which is
 * trivially spoofable. Before we persist or serve an upload we verify the actual
 * bytes and derive the extension from the *detected* type — not the original
 * filename — so a file named `x.png` that is really HTML/JS/SVG is rejected.
 */

const SIGNATURES = [
  { mime: 'image/png', ext: '.png', test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/jpeg', ext: '.jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', ext: '.gif', test: (b) => b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  {
    mime: 'image/webp',
    ext: '.webp',
    // RIFF....WEBP
    test: (b) =>
      b.length > 12 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  }
];

/**
 * Returns { mime, ext } for a recognised raster image, or null if the bytes do
 * not match a supported image type.
 */
function detectImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  for (const sig of SIGNATURES) {
    if (sig.test(buffer)) return { mime: sig.mime, ext: sig.ext };
  }
  return null;
}

module.exports = { detectImage };
