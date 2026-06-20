const Highlight = require('../models/Highlight');

// Get all highlights for a specific chapter
exports.getHighlights = async (req, res, next) => {
  try {
    const { chapterId } = req.query;
    if (!chapterId) {
      return res.status(400).json({ success: false, message: 'chapterId is required' });
    }

    const highlights = await Highlight.find({ 
      userId: req.user._id || req.user.id, 
      chapterId 
    }).sort({ pageNumber: 1, 'boundingRect.y': 1 });

    res.status(200).json({
      success: true,
      data: { highlights }
    });
  } catch (err) {
    next(err);
  }
};

// Create a new highlight
exports.createHighlight = async (req, res, next) => {
  try {
    const { bookId, chapterId, pageNumber, text, color, note, boundingRect, rects } = req.body;

    const highlight = await Highlight.create({
      userId: req.user._id || req.user.id,
      bookId,
      chapterId,
      pageNumber,
      text,
      color,
      note,
      boundingRect,
      rects
    });

    res.status(201).json({
      success: true,
      data: highlight
    });
  } catch (err) {
    next(err);
  }
};

// Update a highlight (e.g., change color or add a note)
exports.updateHighlight = async (req, res, next) => {
  try {
    const highlight = await Highlight.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id || req.user.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!highlight) {
      return res.status(404).json({ success: false, message: 'Highlight not found or unauthorized' });
    }

    res.status(200).json({
      success: true,
      data: highlight
    });
  } catch (err) {
    next(err);
  }
};

// Delete a highlight
exports.deleteHighlight = async (req, res, next) => {
  try {
    const highlight = await Highlight.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id || req.user.id
    });

    if (!highlight) {
      return res.status(404).json({ success: false, message: 'Highlight not found or unauthorized' });
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};
