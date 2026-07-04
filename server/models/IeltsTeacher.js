const mongoose = require('mongoose');

const ieltsTeacherSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  studentIdNumber: {
    type: String
  },
  studentIdCardPhoto: {
    type: String
  },
  nidPhoto: {
    type: String
  },
  ieltsScore: {
    type: String
  },
  ieltsTrf: {
    type: String
  },
  collegeName: {
    type: String
  },
  hscBatch: {
    type: String
  },
  universityName: {
    type: String
  },
  department: {
    type: String
  },
  currentYearSemester: {
    type: String
  },
  admissionAchievement: {
    type: String
  },
  avatar: {
    type: String
  },
  dob: {
    type: Date
  },
  gender: {
    type: String
  },
  verificationStatus: {
    type: String,
    enum: ['unverified', 'pending', 'verified', 'rejected'],
    default: 'unverified'
  },
  verificationNote: {
    type: String,
    default: ''
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  verificationHistory: {
    type: [
      {
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

module.exports = mongoose.model('IeltsTeacher', ieltsTeacherSchema);
