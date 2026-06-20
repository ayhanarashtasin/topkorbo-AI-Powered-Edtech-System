const mongoose = require('mongoose');

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
    min: 1
  },
  text: {
    type: String,
    required: true
  },
  color: {
    type: String,
    default: '#FFEB3B'
  },
  note: {
    type: String,
    default: ''
  },
  // Overall bounding box for the entire highlight
  boundingRect: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  // Individual line rects
  rects: [{
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Touch `updatedAt` on save
highlightSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Highlight', highlightSchema);
