const mongoose = require('mongoose');

const contestSchema = new mongoose.Schema({
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  duration: {
    hours: {
      type: Number,
      required: true
    },
    minutes: {
      type: Number,
      required: true
    }
  },
  startTime: {
    hour: {
      type: Number,
      required: true
    },
    minute: {
      type: Number,
      required: true
    },
    period: {
      type: String,
      enum: ['AM', 'PM'],
      required: true
    },
    timezone: {
      type: String,
      required: true
    }
  },
  level: {
    type: String,
    enum: ['hsc', 'admission'],
    required: true
  },
  subjects: {
    type: [String],
    default: []
  },
  admissionType: {
    type: String,
    enum: ['medical', 'varsity', 'engineering', '']
  },
  admissionSubtype: {
    type: String,
    enum: ['science', 'commerce', 'arts', ''],
    default: ''
  },
  questionType: {
    type: String,
    enum: ['mcq', 'cq', 'both'],
    required: true
  },
  qbankSelections: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  confirmedQuestions: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  contestQuestionsCollection: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Contest', contestSchema);
