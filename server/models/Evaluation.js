const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  question: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Question',
    required: true
  },
  imageUrl: { 
    type: String, 
    required: true 
  },
  totalScore: { 
    type: Number 
  },
  maxScore: { 
    type: Number 
  },
  rubricBreakdown: [{
    criterion: String,
    pointsAwarded: Number,
    feedback: String
  }],
  generalFeedback: { 
    type: String 
  },
  status: { 
    type: String, 
    enum: ['pending', 'graded', 'failed'], 
    default: 'pending' 
  },
  aiProvider: {
    type: String,
    default: 'groq'
  },
  rawAiResponse: {
    type: String // useful for debugging and audit logs
  }
}, { timestamps: true });

module.exports = mongoose.model('Evaluation', evaluationSchema);
