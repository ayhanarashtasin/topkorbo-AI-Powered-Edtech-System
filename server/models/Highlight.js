const mongoose = require('mongoose');

const rectSchema = new mongoose.Schema({
  x: { type: Number, required: true, min: 0, max: 1 },
  y: { type: Number, required: true, min: 0, max: 1 },
  width: { type: Number, required: true, min: 0.000001, max: 1 },
  height: { type: Number, required: true, min: 0.000001, max: 1 }
}, { _id: false });

const highlightSchema = new mongoose.Schema({
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
    min: 1,
    max: 100000
  },
  text: {
    type: String,
    required: true,
    maxlength: 12000
  },
  color: {
    type: String,
    default: '#FFF176',
    match: /^#[0-9A-Fa-f]{6}$/
  },
  note: {
    type: String,
    default: '',
    maxlength: 4000
  },
  // Overall bounding box for the entire highlight
  boundingRect: { type: rectSchema, required: true },
  // Individual line rects
  rects: {
    type: [rectSchema],
    validate: {
      validator: (rects) => Array.isArray(rects) && rects.length >= 1 && rects.length <= 500,
      message: 'rects must contain between 1 and 500 entries'
    }
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

highlightSchema.index({ userId: 1, chapterId: 1, pageNumber: 1, 'boundingRect.y': 1 });

// Touch `updatedAt` on save
highlightSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Highlight', highlightSchema);
