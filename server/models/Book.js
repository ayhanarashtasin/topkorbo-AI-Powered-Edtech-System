const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  order: {
    type: Number,
    default: 0
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    default: 0
  },
  pageCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  // Hierarchy
  category: {
    type: String,
    required: true,
    enum: ['Academic', 'Admission']
  },
  group: {
    type: String,
    required: true,
    enum: ['Science', 'Arts', 'Commerce', 'HSC', 'Engineering', 'Medical', 'Varsity']
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  paper: {
    type: String,
    required: true,
    enum: ['1st', '2nd', 'N/A']
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved',
    index: true
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  chapters: {
    type: [chapterSchema],
    default: []
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for the browse hierarchy
bookSchema.index({ category: 1, group: 1, subject: 1, paper: 1 });
bookSchema.index({ uploadedBy: 1, createdAt: -1 });
bookSchema.index({ approvalStatus: 1, createdAt: -1 });

module.exports = mongoose.model('Book', bookSchema);
