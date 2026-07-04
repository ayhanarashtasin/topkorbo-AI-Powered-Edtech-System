const mongoose = require('mongoose');

const teacherApplicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  checkScript: {
    type: Boolean,
    default: false
  },
  checkScriptDetails: {
    type: String,
    trim: true
  },
  createQuestionBank: {
    type: Boolean,
    default: false
  },
  createQuestionBankSubjects: {
    type: [String],
    default: []
  },
  manageContest: {
    type: Boolean,
    default: false
  },
  manageContestDetails: {
    type: String,
    trim: true
  },
  takeIeltsSpeaking: {
    type: Boolean,
    default: false
  },
  takeIeltsSpeakingDetails: {
    type: String,
    trim: true
  },
  createIeltsQSet: {
    type: Boolean,
    default: false
  },
  createIeltsQSetDetails: {
    type: String,
    trim: true
  },
  aboutYou: {
    type: String,
    required: [true, 'A description about you is required'],
    trim: true,
    minlength: [20, 'Please write at least 20 characters about yourself']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reviewStage: {
    type: String,
    enum: ['pending', 'under_review', 'more_info_requested', 'approved', 'rejected'],
    default: 'pending'
  },
  adminNote: {
    type: String,
    trim: true,
    default: ''
  },
  reviewReason: {
    type: String,
    trim: true,
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
  reviewHistory: {
    type: [
      {
        action: {
          type: String,
          enum: ['submitted', 'under_review', 'approved', 'rejected', 'more_info_requested'],
          required: true
        },
        previousStatus: {
          type: String,
          default: ''
        },
        nextStatus: {
          type: String,
          default: ''
        },
        note: {
          type: String,
          default: ''
        },
        actedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null
        },
        actedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TeacherApplication', teacherApplicationSchema);
