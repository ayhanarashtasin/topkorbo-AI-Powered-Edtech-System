const mongoose = require('mongoose');

const DEFAULT_LIMIT = 20;

function clampLimit(value, fallback = DEFAULT_LIMIT, maximum = 100) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, parsed));
}

function encodeCursor(values) {
  return Buffer.from(JSON.stringify(values), 'utf8').toString('base64url');
}

function decodeCursor(value) {
  if (!value || typeof value !== 'string') return null;

  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!decoded || !mongoose.isValidObjectId(decoded.id)) return null;
    return decoded;
  } catch {
    // Backward compatibility for links created before opaque cursors existed.
    return mongoose.isValidObjectId(value) ? { id: value } : null;
  }
}

function descendingCursorFilter(cursor, fields) {
  const decoded = decodeCursor(cursor);
  if (!decoded) return null;

  const id = new mongoose.Types.ObjectId(decoded.id);
  if (!fields.length || fields.some((field) => decoded[field] === undefined)) {
    return { _id: { $lt: id } };
  }

  const normalized = {};
  for (const field of fields) {
    if (field === 'createdAt') {
      const date = new Date(decoded[field]);
      if (Number.isNaN(date.getTime())) return null;
      normalized[field] = date;
    } else {
      normalized[field] = decoded[field];
    }
  }

  const clauses = [];
  for (let index = 0; index < fields.length; index += 1) {
    const clause = {};
    for (let equalIndex = 0; equalIndex < index; equalIndex += 1) {
      const equalField = fields[equalIndex];
      clause[equalField] = normalized[equalField];
    }
    const rangeField = fields[index];
    clause[rangeField] = { $lt: normalized[rangeField] };
    clauses.push(clause);
  }

  const exactFields = Object.fromEntries(
    fields.map((field) => [field, normalized[field]])
  );
  clauses.push({ ...exactFields, _id: { $lt: id } });
  return { $or: clauses };
}

function ascendingCreatedAtCursorFilter(cursor) {
  const decoded = decodeCursor(cursor);
  if (!decoded) return null;

  const id = new mongoose.Types.ObjectId(decoded.id);
  if (!decoded.createdAt) return { _id: { $gt: id } };

  const createdAt = new Date(decoded.createdAt);
  if (Number.isNaN(createdAt.getTime())) return null;

  return {
    $or: [
      { createdAt: { $gt: createdAt } },
      { createdAt, _id: { $gt: id } }
    ]
  };
}

function cursorForDocument(document, fields) {
  const values = { id: String(document._id) };
  for (const field of fields) {
    const value = document[field];
    values[field] = value instanceof Date ? value.toISOString() : value;
  }
  return encodeCursor(values);
}

function finalizePage(documents, limit, fields) {
  if (documents.length <= limit) {
    return { items: documents, nextCursor: null };
  }

  const items = documents.slice(0, limit);
  return {
    items,
    nextCursor: cursorForDocument(items[items.length - 1], fields)
  };
}

module.exports = {
  clampLimit,
  decodeCursor,
  descendingCursorFilter,
  ascendingCreatedAtCursorFilter,
  cursorForDocument,
  finalizePage
};
