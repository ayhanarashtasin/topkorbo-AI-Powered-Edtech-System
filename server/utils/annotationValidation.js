const MAX_ANNOTATIONS_PER_BATCH = 100;
const MAX_POINTS_PER_STROKE = 6000;
const MAX_POINTS_PER_BATCH = 50000;
const MAX_PAGE_NUMBER = 100000;
const MAX_STROKE_WIDTH = 64;
const MAX_REFERENCE_WIDTH = 20000;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9:_-]{1,96}$/;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validatePageNumber(value) {
  const pageNumber = Number(value);
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > MAX_PAGE_NUMBER) {
    return { error: `pageNumber must be an integer between 1 and ${MAX_PAGE_NUMBER}` };
  }
  return { value: pageNumber };
}

function validateClientId(value) {
  if (typeof value !== 'string' || !CLIENT_ID_PATTERN.test(value)) {
    return { error: 'clientId must be 1-96 letters, numbers, colons, underscores, or hyphens' };
  }
  return { value };
}

function buildAnnotationDoc(annotation, context) {
  if (!annotation || typeof annotation !== 'object' || Array.isArray(annotation)) {
    return { error: 'annotation must be an object' };
  }
  if (annotation.type !== 'pen') return { error: 'type must be pen' };

  const clientId = validateClientId(annotation.clientId);
  if (clientId.error) return clientId;

  if (!Array.isArray(annotation.points) || annotation.points.length < 1) {
    return { error: 'pen annotations need at least 1 point' };
  }
  if (annotation.points.length > MAX_POINTS_PER_STROKE) {
    return { error: `a pen annotation may contain at most ${MAX_POINTS_PER_STROKE} points` };
  }

  const color = annotation.color === undefined ? '#EF4444' : annotation.color;
  if (typeof color !== 'string' || !HEX_COLOR_PATTERN.test(color)) {
    return { error: 'color must be a six-digit hex color' };
  }

  const strokeWidth = annotation.strokeWidth === undefined
    ? 3
    : finiteNumber(annotation.strokeWidth);
  if (strokeWidth === null || strokeWidth < 0.5 || strokeWidth > MAX_STROKE_WIDTH) {
    return { error: `strokeWidth must be between 0.5 and ${MAX_STROKE_WIDTH}` };
  }

  let referenceWidth;
  if (annotation.referenceWidth !== undefined && annotation.referenceWidth !== null) {
    referenceWidth = finiteNumber(annotation.referenceWidth);
    if (referenceWidth === null || referenceWidth < 1 || referenceWidth > MAX_REFERENCE_WIDTH) {
      return { error: `referenceWidth must be between 1 and ${MAX_REFERENCE_WIDTH}` };
    }
  }

  const points = [];
  for (let index = 0; index < annotation.points.length; index += 1) {
    const point = annotation.points[index];
    if (!point || typeof point !== 'object' || Array.isArray(point)) {
      return { error: `points[${index}] must be an object` };
    }
    const x = finiteNumber(point.x);
    const y = finiteNumber(point.y);
    if (x === null || y === null || x < 0 || x > 1 || y < 0 || y > 1) {
      return { error: `points[${index}] coordinates must be finite values between 0 and 1` };
    }

    const normalized = { x, y };
    if (point.w !== undefined && point.w !== null) {
      const width = finiteNumber(point.w);
      if (width === null || width <= 0 || width > MAX_STROKE_WIDTH) {
        return { error: `points[${index}].w must be greater than 0 and at most ${MAX_STROKE_WIDTH}` };
      }
      normalized.w = width;
    }
    if (point.p !== undefined && point.p !== null) {
      const pressure = finiteNumber(point.p);
      if (pressure === null || pressure < 0 || pressure > 1) {
        return { error: `points[${index}].p must be between 0 and 1` };
      }
      normalized.p = pressure;
    }
    points.push(normalized);
  }

  const doc = {
    userId: context.userId,
    bookId: context.bookId,
    chapterId: context.chapterId,
    pageNumber: context.pageNumber,
    clientId: clientId.value,
    type: 'pen',
    color: color.toUpperCase(),
    strokeWidth,
    points
  };
  if (referenceWidth !== undefined) doc.referenceWidth = referenceWidth;
  return { doc };
}

module.exports = {
  MAX_ANNOTATIONS_PER_BATCH,
  MAX_POINTS_PER_STROKE,
  MAX_POINTS_PER_BATCH,
  buildAnnotationDoc,
  validateClientId,
  validatePageNumber
};
