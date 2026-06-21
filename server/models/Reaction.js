const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ['post', 'comment'],
      required: true,
      index: true
    },
    target: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      refPath: 'targetType'
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['like', 'love'],
      required: true
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// A user can only have one reaction of a given type per target
reactionSchema.index({ targetType: 1, target: 1, user: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Reaction', reactionSchema);