const mongoose = require('mongoose');

const ieltsWritingSetSchema = new mongoose.Schema({
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  setName: {
    type: String,
    required: true
  },
  task1: {
    type: {
      type: String,
      enum: ['pdf', 'text', 'image'],
      required: true
    },
    pdfUrl: {
      type: String
    },
    imageUrl: {
      type: String
    },
    textPrompt: {
      type: String
    },
    cleanPrompt: {
      type: String
    }
  },
  task2: {
    type: {
      type: String,
      enum: ['pdf', 'text', 'image'],
      required: true
    },
    pdfUrl: {
      type: String
    },
    imageUrl: {
      type: String
    },
    textPrompt: {
      type: String
    },
    cleanPrompt: {
      type: String
    }
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

ieltsWritingSetSchema.index({ approvalStatus: 1, createdAt: -1 });

module.exports = mongoose.model('IeltsWritingSet', ieltsWritingSetSchema);
