const mongoose = require('mongoose');

/**
 * One point in a pen stroke.
 *
 * Coordinates are stored as NORMALISED values in the range [0, 1] relative
 * to the page's CSS box at draw time, so the same stroke renders correctly
 * at any zoom level.
 *
 *   x: horizontal position, 0 = left, 1 = right
 *   y: vertical   position, 0 = top,  1 = bottom
 *   w: (optional) per-point stroke width in CSS px at the original scale.
 *      Used for pressure-sensitive / velocity-sensitive variable width.
 *   p: (optional) per-point pressure in [0, 1]. 0 = no device pressure
 *      (mouse / non-pressure stylus).
 */
const pointSchema = new mongoose.Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  w: { type: Number },
  p: { type: Number }
}, { _id: false });

const annotationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
    index: true
  },
  chapterId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  pageNumber: {
    type: Number,
    required: true,
    min: 1
  },
  type: {
    type: String,
    enum: ['pen'],
    required: true
  },
  color: {
    type: String,
    default: '#EF4444'
  },
  // Pen-only
  points: {
    type: [pointSchema],
    default: undefined
  },
  // Base stroke width in CSS px. The actual rendered width for a segment is
  // modulated by per-point w (and p) — this is just the chosen tool size.
  strokeWidth: {
    type: Number,
    default: 3
  },
  // Optimistic-concurrency hint. Bumped when the document is updated.
  // Not enforced yet, but useful for future PATCH endpoints.
  version: {
    type: Number,
    default: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

annotationSchema.index({ userId: 1, chapterId: 1, pageNumber: 1 });

// Touch `updatedAt` on save so the bulk endpoint can return the latest
// timestamps to the client (used for ordering and audit).
annotationSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Annotation', annotationSchema);
