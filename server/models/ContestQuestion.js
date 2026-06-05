const mongoose = require('mongoose');

const dynamicQuestionSchema = new mongoose.Schema({
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
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Helper to retrieve/create model for a dynamic collection
const getContestQuestionModel = (contestName) => {
  const safeName = contestName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  const collectionName = `${safeName}_questions`;
  
  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }
  return mongoose.model(collectionName, dynamicQuestionSchema, collectionName);
};

module.exports = {
  getContestQuestionModel,
  dynamicQuestionSchema
};
