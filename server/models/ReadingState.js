const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
  pageNumber: {
    type: Number,
    required: true
  },
  label: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const readingStateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true
  },
  chapterId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  lastPage: {
    type: Number,
    default: 1
  },
  lastReadAt: {
    type: Date,
    default: Date.now
  },
  bookmarks: {
    type: [bookmarkSchema],
    default: []
  }
});

readingStateSchema.index({ userId: 1, bookId: 1, chapterId: 1 }, { unique: true });
readingStateSchema.index({ userId: 1, bookId: 1, lastReadAt: -1 });

module.exports = mongoose.model('ReadingState', readingStateSchema);
