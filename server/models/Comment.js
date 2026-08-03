const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: '' }
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null
    },
    contentHtml: { type: String, default: '' },
    contentText: { type: String, default: '' },
    images: { type: [imageSchema], default: [] },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reactionsCount: {
      like: { type: Number, default: 0 },
      love: { type: Number, default: 0 }
    },
    repliesCount: { type: Number, default: 0 },
    depth: { type: Number, default: 0 }, // visual indent level
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    isHidden: { type: Boolean, default: false }
  },
  { timestamps: true }
);

commentSchema.index({ post: 1, isHidden: 1, createdAt: 1, _id: 1 });
commentSchema.index({ post: 1, parent: 1, isHidden: 1, createdAt: 1 });
commentSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
