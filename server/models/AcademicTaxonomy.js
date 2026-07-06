const mongoose = require('mongoose');

const academicTaxonomySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['subject', 'paper', 'chapter', 'topic'],
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicTaxonomy',
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true
    },
    order: {
      type: Number,
      default: 0
    },
    source: {
      type: String,
      enum: ['manual', 'legacy_sync'],
      default: 'manual'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    archivedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

academicTaxonomySchema.index(
  { type: 1, parentId: 1, normalizedName: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' }
  }
);

academicTaxonomySchema.index({ parentId: 1, type: 1, order: 1, name: 1 });

module.exports = mongoose.model('AcademicTaxonomy', academicTaxonomySchema);
