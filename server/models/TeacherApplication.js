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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TeacherApplication', teacherApplicationSchema);
