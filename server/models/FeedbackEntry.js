const mongoose = require('mongoose');

const feedbackNoteSchema = new mongoose.Schema(
  {
    note: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const feedbackEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    itemType: {
      type: String,
      enum: ['question', 'book', 'contest', 'ielts_set', 'platform'],
      default: 'platform',
      index: true
    },
    itemId: {
      type: String,
      default: '',
      index: true
    },
    itemTitle: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    rating: {
      type: Number,
      default: null,
      min: 1,
      max: 5
    },
    status: {
      type: String,
      enum: ['new', 'reviewed', 'dismissed', 'resolved'],
      default: 'new',
      index: true
    },
    adminNotes: {
      type: [feedbackNoteSchema],
      default: []
    }
  },
  { timestamps: true }
);

feedbackEntrySchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('FeedbackEntry', feedbackEntrySchema);
