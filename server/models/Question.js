const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  questionText: {
    type: String,
    required: [true, 'Question text is required']
  },
  imageUrl: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['mcq', 'written', 'cq'],
    required: [true, 'Question type is required']
  },
  // MCQ options — each option has LaTeX text and a correctness flag
  options: [
    {
      text: { type: String },
      isCorrect: { type: Boolean, default: false }
    }
  ],
  // CQ (Creative Question) details
  cq: {
    description: { type: String },
    parts: [
      {
        label: { type: String, enum: ['a', 'b', 'c', 'd'] },
        text: { type: String }
      }
    ]
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    enum: [
      'Physics',
      'Chemistry',
      'Higher Math',
      'Biology',
      'Bangla',
      'English',
      'ICT',
      'Statistics',
      'Accounting',
      'Finance',
      'Economics',
      'Management'
    ]
  },
  paper: {
    type: String,
    enum: ['1st', '2nd'],
    required: [true, 'Paper selection is required']
  },
  chapter: {
    type: String,
    required: [true, 'Chapter is required']
  },
  topic: {
    type: String,
    required: [true, 'Topic is required']
  },
  // Flexible tag system for Board and Admission categorization
  tags: [
    {
      category: {
        type: String,
        enum: ['board', 'admission'],
        required: true
      },
      // For board tags
      board: { type: String },
      // For admission tags
      university: { type: String },
      unit: { type: String },
      // Common
      year: { type: String }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Validate questions based on type (MCQ/CQ)
questionSchema.pre('validate', function (next) {
  if (this.type === 'mcq') {
    const validOptions = (this.options || []).filter(o => o.text && o.text.trim());
    if (validOptions.length < 2) {
      return next(new Error('MCQ questions must have at least 2 options'));
    }
    if (validOptions.length > 4) {
      return next(new Error('MCQ questions cannot have more than 4 options'));
    }
    const hasCorrect = validOptions.some(o => o.isCorrect);
    if (!hasCorrect) {
      return next(new Error('MCQ questions must have at least one correct answer'));
    }
  } else if (this.type === 'cq') {
    if (!this.cq || !this.cq.description || !this.cq.description.trim()) {
      return next(new Error('Creative Question must have a description (stem)'));
    }
    const parts = this.cq.parts || [];
    if (parts.length !== 4) {
      return next(new Error('Creative Question must have exactly 4 sub-questions (a, b, c, d)'));
    }
    const hasEmpty = parts.some(p => !p.text || !p.text.trim());
    if (hasEmpty) {
      return next(new Error('All 4 sub-questions must be filled'));
    }
  }
  next();
});

module.exports = mongoose.model('Question', questionSchema);
