const mongoose = require('mongoose');

const ieltsListeningSetSchema = new mongoose.Schema({
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  setName: {
    type: String,
    required: true,
    default: 'IELTS Listening Practice Set'
  },
  sections: [
    {
      sectionNumber: {
        type: Number,
        required: true,
        enum: [1, 2, 3, 4]
      },
      audioUrl: {
        type: String,
        required: true
      },
      pdfUrl: {
        type: String,
        required: true
      }
    }
  ],
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

ieltsListeningSetSchema.index({ approvalStatus: 1, createdAt: -1 });

module.exports = mongoose.model('IeltsListeningSet', ieltsListeningSetSchema);
