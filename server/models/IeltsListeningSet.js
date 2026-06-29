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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('IeltsListeningSet', ieltsListeningSetSchema);
