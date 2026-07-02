const mongoose = require('mongoose');

const bookChunkSchema = new mongoose.Schema({
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
  pageNumbers: {
    type: [Number],
    default: []
  },
  nodeId: {
    type: String,
    default: '',
    index: true
  },
  nodeType: {
    type: String,
    default: '',
    index: true
  },
  topicId: {
    type: String,
    default: '',
    index: true
  },
  chunkIndex: {
    type: Number,
    default: 0
  },
  pageStart: {
    type: Number,
    required: true,
    index: true
  },
  pageEnd: {
    type: Number,
    required: true,
    index: true
  },
  text: {
    type: String,
    required: true
  },
  embedding: {
    type: [Number],
    default: []
  },
  tokenCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

bookChunkSchema.index({ bookId: 1, chapterId: 1, topicId: 1, pageStart: 1 });

module.exports = mongoose.model('BookChunk', bookChunkSchema);
