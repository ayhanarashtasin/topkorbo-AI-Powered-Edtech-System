const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    width: { type: Number },
    height: { type: Number }
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'question'], default: 'text' },
    category: {
      type: String,
      enum: [
        'Mathematics',
        'Physics',
        'Chemistry',
        'Biology',
        'General',
        'Exam',
        'Assignment',
        'Other'
      ],
      default: 'General'
    },
    title: { type: String, trim: true, maxlength: 200 },
    contentHtml: { type: String, required: true },
    contentText: { type: String, default: '' },
    images: { type: [imageSchema], default: [] },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    tags: { type: [String], default: [] },
    groupVisibility: [
      {
        type: String,
        enum: ['Science', 'Business Studies', 'Humanities']
      }
    ],
    reactionsCount: {
      like: { type: Number, default: 0 },
      love: { type: Number, default: 0 }
    },
    commentsCount: { type: Number, default: 0 },
    bookmarksCount: { type: Number, default: 0 },
    score: { type: Number, default: 0 }, // trending score
    isEdited: { type: Boolean, default: false },
    isHidden: { type: Boolean, default: false },
    hiddenReason: { type: String, default: '' },
    editedAt: { type: Date }
  },
  { timestamps: true }
);

// Compound indexes for feed queries
postSchema.index({ isHidden: 1, createdAt: -1, _id: -1 });
postSchema.index({ isHidden: 1, category: 1, createdAt: -1, _id: -1 });
postSchema.index({ isHidden: 1, score: -1, createdAt: -1, _id: -1 });
postSchema.index({ isHidden: 1, category: 1, score: -1, createdAt: -1, _id: -1 });
postSchema.index({ isHidden: 1, commentsCount: -1, createdAt: -1, _id: -1 });
postSchema.index({ isHidden: 1, category: 1, commentsCount: -1, createdAt: -1, _id: -1 });
postSchema.index({ author: 1, isHidden: 1, createdAt: -1, _id: -1 });

// Full-text index for search
postSchema.index(
  { title: 'text', contentText: 'text', tags: 'text' },
  { weights: { title: 5, tags: 3, contentText: 1 }, name: 'PostTextIndex' }
);

// Virtual for total reactions
postSchema.virtual('totalReactions').get(function () {
  return (this.reactionsCount?.like || 0) + (this.reactionsCount?.love || 0);
});

postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Post', postSchema);
