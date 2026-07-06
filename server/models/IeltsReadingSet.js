const mongoose = require('mongoose');

const ieltsReadingSetSchema = new mongoose.Schema({
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  setName: {
    type: String,
    required: true
  },
  passage1: {
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
  passage2: {
    type: {
      type: String,
      enum: ['pdf', 'text', 'image']
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
  passage3: {
    type: {
      type: String,
      enum: ['pdf', 'text', 'image']
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('IeltsReadingSet', ieltsReadingSetSchema);
