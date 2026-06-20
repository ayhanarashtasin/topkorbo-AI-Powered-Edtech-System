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
    required: true,
    index: true
  },
  pageNumber: {
    type: Number,
    required: true,
    min: 1
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index used by the hot path: history for (user, chapter, page).
chatMessageSchema.index({ userId: 1, chapterId: 1, pageNumber: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);