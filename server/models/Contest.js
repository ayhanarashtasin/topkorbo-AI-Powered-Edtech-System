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
    default: 'contest_questions'
  },
  questions: [
    {
      source: {
        type: String,
        enum: ['uploaded', 'qbank'],
        required: true
      },
      originalQuestionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        default: null
      },
      selectionMeta: {
        subject: { type: String, default: '' },
        paper: { type: String, default: '' },
        chapter: { type: String, default: '' },
        topic: { type: String, default: '' },
        numberOfQuestions: { type: Number, default: 0 }
      },
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
      options: [
        {
          text: { type: String },
          isCorrect: { type: Boolean, default: false }
        }
      ],
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
        required: [true, 'Subject is required']
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
      solution: {
        type: String,
        default: ''
      },
      solutionImageUrl: {
        type: String,
        default: ''
      },
      tags: [
        {
          category: {
            type: String,
            enum: ['board', 'admission', 'college'],
            required: true
          },
          board: { type: String },
          university: { type: String },
          unit: { type: String },
          shift: { type: String },
          college: { type: String },
          year: { type: String }
        }
      ]
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { collection: 'contest_questions' });

module.exports = mongoose.model('Contest', contestSchema);
