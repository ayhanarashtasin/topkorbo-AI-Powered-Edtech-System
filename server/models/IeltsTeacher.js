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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('IeltsTeacher', ieltsTeacherSchema);
