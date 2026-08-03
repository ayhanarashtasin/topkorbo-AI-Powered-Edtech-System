const mongoose = require('mongoose');
const Book = require('../models/Book');
const Highlight = require('../models/Highlight');
const {
  validateHighlightCreate,
  validateHighlightUpdate
} = require('../utils/highlightValidation');

function userId(req) {
  return req.user._id || req.user.id;
}

function boundingRectFor(rects) {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

// Get the authenticated user's highlights for a chapter. The compound model
// index supports both the equality filter and this display order.
exports.getHighlights = async (req, res, next) => {
  try {
    const { chapterId } = req.query;
    if (!mongoose.isValidObjectId(chapterId)) {
      return res.status(400).json({ success: false, message: 'Valid chapterId is required' });
    }

    const highlights = await Highlight.find({ userId: userId(req), chapterId })
      .sort({ pageNumber: 1, 'boundingRect.y': 1 })
      .lean();

    return res.status(200).json({ success: true, data: { highlights } });
  } catch (err) {
    next(err);
  }
};

exports.createHighlight = async (req, res, next) => {
  try {
    const parsed = validateHighlightCreate(req.body);
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const book = await Book.findOne({
      _id: parsed.value.bookId,
      'chapters._id': parsed.value.chapterId
    }).select('_id').lean();
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book or chapter not found' });
    }

    const highlight = await Highlight.create({ userId: userId(req), ...parsed.value });
    return res.status(201).json({ success: true, data: highlight });
  } catch (err) {
    next(err);
  }
};

exports.updateHighlight = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Highlight not found' });
    }
    const parsed = validateHighlightUpdate(req.body);
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }
    if (parsed.value.rects && !parsed.value.boundingRect) {
      parsed.value.boundingRect = boundingRectFor(parsed.value.rects);
    }

    const highlight = await Highlight.findOneAndUpdate(
      { _id: req.params.id, userId: userId(req) },
      { $set: parsed.value },
      { new: true, runValidators: true }
    ).lean();

    if (!highlight) {
      return res.status(404).json({ success: false, message: 'Highlight not found' });
    }
    return res.status(200).json({ success: true, data: highlight });
  } catch (err) {
    next(err);
  }
};

exports.deleteHighlight = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Highlight not found' });
    }
    const result = await Highlight.deleteOne({ _id: req.params.id, userId: userId(req) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Highlight not found' });
    }
    return res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
