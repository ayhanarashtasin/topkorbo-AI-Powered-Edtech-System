const mongoose = require('mongoose');

const quizQuestionSchema = new mongoose.Schema({
  question: { type: String, default: '' },
  options: { type: [String], default: [] },
  answer: { type: String, default: '' },
  explanation: { type: String, default: '' }
}, { _id: false });

const topicSchema = new mongoose.Schema({
  nodeId: { type: String, default: '' },
  nodeType: { type: String, default: 'topic' },
  topicId: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  order: { type: Number, default: 0 },
  pageRange: {
    start: { type: Number, default: 1 },
    end: { type: Number, default: 1 }
  },
  summary: { type: String, default: '' },
  detailedNotes: { type: String, default: '' },
  keyPoints: { type: [String], default: [] },
  definitions: { type: [String], default: [] },
  examples: { type: [String], default: [] },
  quizQuestions: { type: [quizQuestionSchema], default: [] },
  subtopics: { type: [mongoose.Schema.Types.Mixed], default: [] },
  chunkIds: { type: [mongoose.Schema.Types.ObjectId], default: [] }
}, { _id: false });

const chapterSchema = new mongoose.Schema({
  nodeId: { type: String, default: '' },
  nodeType: { type: String, default: 'chapter' },
  chapterId: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  order: { type: Number, default: 0 },
  pageRange: {
    start: { type: Number, default: 1 },
    end: { type: Number, default: 1 }
  },
  summary: { type: String, default: '' },
  detailedNotes: { type: String, default: '' },
  keyPoints: { type: [String], default: [] },
  definitions: { type: [String], default: [] },
  examples: { type: [String], default: [] },
  quizQuestions: { type: [quizQuestionSchema], default: [] },
  topics: { type: [topicSchema], default: [] }
}, { _id: false });

const bookKnowledgeSchema = new mongoose.Schema({
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['not_started', 'extracting_text', 'chunking', 'embedding', 'indexing', 'completed', 'failed', 'pending'],
    default: 'not_started',
    index: true
  },
  message: {
    type: String,
    default: ''
  },
  totalPages: {
    type: Number,
    default: 0
  },
  extractedPages: {
    type: Number,
    default: 0
  },
  emptyPages: {
    type: Number,
    default: 0
  },
  totalChunks: {
    type: Number,
    default: 0
  },
  embeddedChunks: {
    type: Number,
    default: 0
  },
  lastProcessingError: {
    type: String,
    default: ''
  },
  vectorIndexStatus: {
    type: String,
    default: 'not_started'
  },
  version: {
    type: Number,
    default: 1
  },
  sourcePages: {
    type: Number,
    default: 0
  },
  documentType: {
    type: String,
    default: 'unknown',
    index: true
  },
  tree: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  nodes: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  chapters: {
    type: [chapterSchema],
    default: []
  },
  bookSummary: {
    type: String,
    default: ''
  },
  bookKeyPoints: {
    type: [String],
    default: []
  },
  completedAt: {
    type: Date,
    default: null
  },
  startedAt: {
    type: Date,
    default: null
  },
  failedAt: {
    type: Date,
    default: null
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

bookKnowledgeSchema.index({ bookId: 1, status: 1 });

module.exports = mongoose.model('BookKnowledge', bookKnowledgeSchema);
