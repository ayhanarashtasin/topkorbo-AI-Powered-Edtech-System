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
      enum: ['pdf', 'text'],
      required: true
    },
    pdfUrl: {
      type: String
    },
    textPrompt: {
      type: String
    }
  },
  task2: {
    type: {
      type: String,
      enum: ['pdf', 'text'],
      required: true
    },
    pdfUrl: {
      type: String
    },
    textPrompt: {
      type: String
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('IeltsWritingSet', ieltsWritingSetSchema);
