const mongoose = require('mongoose');

/**
 * ChatMessage — one turn in a student's AI tutor conversation.
 *
 * Keyed by (userId, chapterId, pageNumber) so we can pull per-page history
 * cheaply. `role` follows the OpenAI/Groq chat-completions vocabulary so the
 * controller can pass history straight through to the LLM.
 */
const chatMessageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
    index: true
  },
  chapterId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true
  },
  topicId: {
    type: String,
    default: '',
    index: true
  },
  nodeId: {
    type: String,
    default: '',
    index: true
  },
  contextType: {
    type: String,
    enum: ['page', 'topic', 'chapter', 'book', 'node', 'legacy'],
    default: 'legacy',
    index: true
  },
  contextKey: {
    type: String,
    default: '',
    index: true
  },
  pageNumber: {
    type: Number,
    default: null,
    validate: {
      validator(value) {
        return value === null || value === undefined || (Number.isInteger(value) && value >= 1);
      },
      message: 'pageNumber must be null or a positive integer'
    }
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  sources: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index used by the hot path: history for (user, chapter, page).
chatMessageSchema.index({ userId: 1, chapterId: 1, pageNumber: 1, createdAt: 1 });
chatMessageSchema.index({ userId: 1, contextKey: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
