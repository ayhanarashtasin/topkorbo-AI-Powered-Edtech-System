const mongoose = require('mongoose');

const MAX_HIGHLIGHT_RECTS = 500;
const MAX_HIGHLIGHT_TEXT = 12000;
const MAX_NOTE_LENGTH = 4000;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validateRect(rect, label = 'rect') {
  if (!rect || typeof rect !== 'object' || Array.isArray(rect)) {
    return { error: `${label} must be an object` };
  }
  const x = finiteNumber(rect.x);
  const y = finiteNumber(rect.y);
  const width = finiteNumber(rect.width);
  const height = finiteNumber(rect.height);
  if ([x, y, width, height].some((value) => value === null)) {
    return { error: `${label} values must be finite numbers` };
  }
  if (x < 0 || y < 0 || x > 1 || y > 1 || width <= 0 || height <= 0 || width > 1 || height > 1) {
    return { error: `${label} must use positive normalized coordinates between 0 and 1` };
  }
  if (x + width > 1.001 || y + height > 1.001) {
    return { error: `${label} must stay within the page bounds` };
  }
  return { value: { x, y, width, height } };
}

function validateRects(value, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    return { error: allowEmpty ? 'rects must be an array' : 'rects must be a non-empty array' };
  }
  if (value.length > MAX_HIGHLIGHT_RECTS) {
    return { error: `rects may contain at most ${MAX_HIGHLIGHT_RECTS} entries` };
  }
  const rects = [];
  for (let index = 0; index < value.length; index += 1) {
    const result = validateRect(value[index], `rects[${index}]`);
    if (result.error) return result;
    rects.push(result.value);
  }
  return { value: rects };
}

function validateHighlightCreate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be an object' };
  }
  if (!mongoose.isValidObjectId(body.bookId) || !mongoose.isValidObjectId(body.chapterId)) {
    return { error: 'Valid bookId and chapterId are required' };
  }
  const pageNumber = Number(body.pageNumber);
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 100000) {
    return { error: 'pageNumber must be a positive integer' };
  }
  if (typeof body.text !== 'string' || body.text.trim().length === 0 || body.text.length > MAX_HIGHLIGHT_TEXT) {
    return { error: `text must contain 1-${MAX_HIGHLIGHT_TEXT} characters` };
  }
  const color = body.color === undefined ? '#FFEB3B' : body.color;
  if (typeof color !== 'string' || !HEX_COLOR_PATTERN.test(color)) {
    return { error: 'color must be a six-digit hex color' };
  }
  const note = body.note === undefined ? '' : body.note;
  if (typeof note !== 'string' || note.length > MAX_NOTE_LENGTH) {
    return { error: `note may contain at most ${MAX_NOTE_LENGTH} characters` };
  }
  const boundingRect = validateRect(body.boundingRect, 'boundingRect');
  if (boundingRect.error) return boundingRect;
  const rects = validateRects(body.rects);
  if (rects.error) return rects;

  return {
    value: {
      bookId: body.bookId,
      chapterId: body.chapterId,
      pageNumber,
      text: body.text.trim(),
      color: color.toUpperCase(),
      note,
      boundingRect: boundingRect.value,
      rects: rects.value
    }
  };
}

function validateHighlightUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be an object' };
  }
  const value = {};
  const allowed = new Set(['color', 'note', 'rects', 'boundingRect']);
  const supplied = Object.keys(body);
  if (supplied.length === 0) return { error: 'At least one update field is required' };
  if (supplied.some((key) => !allowed.has(key))) return { error: 'Only color, note, rects, and boundingRect may be updated' };

  if (body.color !== undefined) {
    if (typeof body.color !== 'string' || !HEX_COLOR_PATTERN.test(body.color)) {
      return { error: 'color must be a six-digit hex color' };
    }
    value.color = body.color.toUpperCase();
  }
  if (body.note !== undefined) {
    if (typeof body.note !== 'string' || body.note.length > MAX_NOTE_LENGTH) {
      return { error: `note may contain at most ${MAX_NOTE_LENGTH} characters` };
    }
    value.note = body.note;
  }
  if (body.rects !== undefined) {
    const rects = validateRects(body.rects, { allowEmpty: false });
    if (rects.error) return rects;
    value.rects = rects.value;
  }
  if (body.boundingRect !== undefined) {
    const boundingRect = validateRect(body.boundingRect, 'boundingRect');
    if (boundingRect.error) return boundingRect;
    value.boundingRect = boundingRect.value;
  }
  value.updatedAt = new Date();
  return { value };
}

module.exports = {
  MAX_HIGHLIGHT_RECTS,
  validateHighlightCreate,
  validateHighlightUpdate,
  validateRect,
  validateRects
};
