/**
 * Magic-byte (content) detection for uploaded images.
 *
 * multer's `fileFilter` only sees the client-supplied `file.mimetype`, which is
 * trivially spoofable. Before we persist or serve an upload we verify the actual
 * bytes and derive the extension from the *detected* type — not the original
 * filename — so a file named `x.png` that is really HTML/JS/SVG is rejected.
 */

// Each signature tests the first few bytes of a file to identify its true format.
// The test function receives a Buffer and returns true if the bytes match.
const SIGNATURES = [
  // PNG: 8-byte header → 0x89 P N G (with line break and DOS EOF)
  { mime: 'image/png', ext: '.png', test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  // JPEG: starts with FF D8 FF (SOI marker + application marker)
  { mime: 'image/jpeg', ext: '.jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  // GIF: "GIF" magic string (GIF87a or GIF89a)
  { mime: 'image/gif', ext: '.gif', test: (b) => b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  // WebP: RIFF container with WEBP chunk identifier at offset 8
  { mime: 'image/webp', ext: '.webp',
    test: (b) =>
      b.length > 12 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // "RIFF"
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50    // "WEBP"
  }
];

/**
 * Inspect the first bytes of a buffer to identify its image format.
 *
 * Returns { mime, ext } for a recognised raster image, or null if the bytes do
 * not match any supported type. Requires at least 12 bytes for reliable detection.
 */
function detectImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  for (const sig of SIGNATURES) {
    if (sig.test(buffer)) return { mime: sig.mime, ext: sig.ext };
  }
  return null;
}

module.exports = { detectImage };
