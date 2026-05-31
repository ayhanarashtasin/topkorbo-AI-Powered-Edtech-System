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
    enum: ['mcq', 'written'],
    required: [true, 'Question type is required']
  },
  // MCQ options — each option has LaTeX text and a correctness flag
  options: [
    {
      text: { type: String },
      isCorrect: { type: Boolean, default: false }
    }
  ],
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

// Validate MCQ questions must have at least 2 options
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
  }
  next();
});

module.exports = mongoose.model('Question', questionSchema);
