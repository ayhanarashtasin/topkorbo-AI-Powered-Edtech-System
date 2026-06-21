const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  avatar: {
    type: String
  },
  role: {
    type: String,
    enum: ['student', 'tutor', 'teacher'],
    required: true
  },
  // Student Profile Information
  collegeName: {
    type: String
  },
  hscBatch: {
    type: String
  },
  stream: {
    type: String,
    enum: ['Science', 'Business Studies', 'Humanities']
  },
  academicStatus: {
    type: String,
    enum: ['HSC 1st Year', 'HSC 2nd Year', 'HSC Passed', 'Admission Candidate']
  },
  medium: {
    type: String,
    enum: ['English Medium', 'English Version', 'Bangla Medium']
  },
  district: {
    type: String
  },
  division: {
    type: String
  },
  areaName: {
    type: String
  },
  phoneNumber: {
    type: String
  },
  dob: {
    type: String
  },
  gender: {
    type: String,
    enum: ['Male', 'Female']
  },
  aspirations: {
    type: [String],
    enum: ['Engineering', 'University', 'Medical']
  },
  optionalSubject: {
    type: String,
    enum: ['Math', 'Biology', 'Statistics']
  },
  // ============ Forum / Community additions ============
  username: { type: String, unique: true, sparse: true, index: true, lowercase: true, trim: true },
  bio: { type: String, default: '', maxlength: 280 },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reputation: { type: Number, default: 0 },
  warnings: [
    {
      reason: String,
      issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      issuedAt: { type: Date, default: Date.now }
    }
  ],
  isBanned: { type: Boolean, default: false },
  banReason: { type: String, default: '' },
  banExpiresAt: { type: Date },
  bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  forumRole: {
    type: String,
    enum: ['user', 'moderator', 'admin'],
    default: 'user'
  },
  // Mentor / Tutor Profile Information
  studentIdNumber: {
    type: String
  },
  studentIdCardPhoto: {
    type: String
  },
  interestedToGuide: {
    type: [String],
    enum: ['Medical', 'Buet', 'University', 'HSC Academic']
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
