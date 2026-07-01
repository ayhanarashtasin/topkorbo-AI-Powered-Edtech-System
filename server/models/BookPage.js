const mongoose = require('mongoose');

const bookPageSchema = new mongoose.Schema({
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
    index: true
  },
  chapterId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true
  },
  pageNumber: {
    type: Number,
    required: true,
    index: true
  },
  extractedText: {
    type: String,
    default: ''
  },
  processingStatus: {
    type: String,
    enum: ['not_started', 'extracting_text', 'chunking', 'embedding', 'indexing', 'completed', 'failed', 'empty'],
    default: 'not_started',
    index: true
  },
  wordCount: {
    type: Number,
    default: 0
  },
  extractionMethod: {
    type: String,
    default: 'pdf-parse'
  },
  errorMessage: {
    type: String,
    default: ''
  }
}, { timestamps: true });

bookPageSchema.index({ bookId: 1, chapterId: 1, pageNumber: 1 }, { unique: true });

module.exports = mongoose.model('BookPage', bookPageSchema);
