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
  // Contest rating (null until the student has given at least one rated contest)
  rating: { type: Number, default: null },
  maxRating: { type: Number, default: null },
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
  // ============ Subscription / Pricing ============
  // Effective plan is resolved through services/planService.getEffectivePlan
  // (a paid plan whose planExpiresAt has passed is treated as 'free').
  plan: {
    type: String,
    enum: ['free', 'pro', 'pro_plus'],
    default: 'free'
  },
  planExpiresAt: { type: Date, default: null }, // null = never expires (free)
  // True while the current paid-tier access came from the free signup trial
  // rather than a real payment. Cleared when a payment grants a plan or when
  // the plan lazily downgrades to free.
  planIsTrial: { type: Boolean, default: false },
  // Lifetime usage counters (free-tier limits are lifetime totals — no reset job).
  usage: {
    qbankExams: { type: Number, default: 0 },
    mockTests: { type: Number, default: 0 },
    battleRooms: { type: Number, default: 0 },
    aiActions: { type: Number, default: 0 }
  },
  // Mentor / Tutor Profile Information
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
  interestedToGuide: {
    type: [String],
    enum: ['Medical', 'Engineering', 'University', 'Academic', 'IELTS']
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

userSchema.index({ role: 1, isBanned: 1, createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
