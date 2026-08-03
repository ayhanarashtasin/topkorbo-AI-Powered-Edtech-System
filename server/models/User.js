const mongoose = require('mongoose');
const { normalizeSearchText } = require('../utils/searchNormalization');

const INTERESTED_TO_GUIDE_VALUES = ['Medical', 'Engineering', 'University', 'Academic', 'IELTS'];

function normalizeInterestedToGuide(values) {
  if (!Array.isArray(values)) return values;

  const legacyValueMap = {
    buet: 'Engineering',
    'hsc academic': 'Academic'
  };

  return values
    .map((value) => {
      const raw = String(value || '').trim();
      if (!raw) return '';
      const directMatch = INTERESTED_TO_GUIDE_VALUES.find(
        (allowed) => allowed.toLowerCase() === raw.toLowerCase()
      );
      if (directMatch) return directMatch;

      return legacyValueMap[raw.toLowerCase()] || raw;
    })
    .filter(Boolean);
}

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
  searchName: {
    type: String,
    default: '',
    index: true,
    select: false
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  // Optional local-only hash reserved for dev/admin seed flows.
  passwordHash: {
    type: String,
    default: '',
    select: false
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
  // Contest rating starts at 0 and changes after finished rated contests.
  rating: { type: Number, default: 0 },
  maxRating: { type: Number, default: 0 },
  // Lifetime cumulative contest points (gamification currency; only ever grows).
  contestPoints: { type: Number, default: 0, index: true },
  contestsPlayed: { type: Number, default: 0 },
  // ============ Forum / Community additions ============
  username: { type: String, unique: true, sparse: true, index: true, lowercase: true, trim: true },
  bio: { type: String, default: '', maxlength: 280 },
  reputation: { type: Number, default: 0 },
  warnings: [
    {
      reason: String,
      issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      issuedAt: { type: Date, default: Date.now }
    }
  ],
  isBanned: { type: Boolean, default: false },
  accountStatus: {
    type: String,
    enum: ['active', 'suspended', 'banned'],
    default: 'active'
  },
  statusReason: { type: String, default: '' },
  banReason: { type: String, default: '' },
  banExpiresAt: { type: Date },
  suspendedAt: { type: Date, default: null },
  statusChangedAt: { type: Date, default: null },
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
    enum: INTERESTED_TO_GUIDE_VALUES,
    set: normalizeInterestedToGuide
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
  lastActiveAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.index({ role: 1, isBanned: 1, createdAt: -1 });
userSchema.index({ accountStatus: 1, createdAt: -1 });
userSchema.index({ forumRole: 1, createdAt: -1 });

userSchema.pre('validate', function normalizeLegacyGuideValues(next) {
  if (Array.isArray(this.interestedToGuide)) {
    this.interestedToGuide = normalizeInterestedToGuide(this.interestedToGuide);
  }
  this.searchName = normalizeSearchText(this.name);
  next();
});

userSchema.pre(['findOneAndUpdate', 'updateOne'], function normalizeUpdatedName(next) {
  const update = this.getUpdate() || {};
  const name = update.$set?.name ?? update.name;
  if (name !== undefined) {
    update.$set = {
      ...(update.$set || {}),
      name,
      searchName: normalizeSearchText(name)
    };
    if (Object.hasOwn(update, 'name')) delete update.name;
    this.setUpdate(update);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
