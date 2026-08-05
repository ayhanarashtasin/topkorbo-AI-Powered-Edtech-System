/**
 * Cursor-based pagination utilities for forum endpoints.
 *
 * Uses opaque base64url cursors to avoid exposing internal IDs while supporting
 * both descending (newest-first) and ascending (oldest-first) orderings across
 * one or more sort fields.  Cursors encode the sort key values plus the _id of
 * the last document so MongoDB can efficiently skip to the next page without
 * the performance penalty of offset-based pagination.
 */

const mongoose = require('mongoose');

/** Default and maximum page sizes used when the client omits a limit. */
const DEFAULT_LIMIT = 20;

/**
 * Clamp the user-supplied limit to a sane range.
 * Returns `fallback` for non-numeric input and caps at `maximum`.
 */
function clampLimit(value, fallback = DEFAULT_LIMIT, maximum = 100) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, parsed));
}

/**
 * Encode an object of sort-key values into a URL-safe opaque cursor string.
 * The object is JSON-serialised then base64url-encoded so the cursor never
 * leaks raw IDs or sort values to the client.
 */
function encodeCursor(values) {
  return Buffer.from(JSON.stringify(values), 'utf8').toString('base64url');
}

/**
 * Decode an opaque cursor back into its sort-key object.
 *
 * For backward compatibility, bare ObjectIds (legacy cursor format) are also
 * accepted and wrapped in `{ id }`.
 * Returns null when the cursor is missing, malformed, or contains an invalid
 * MongoDB ObjectId.
 */
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

/**
 * Build a MongoDB filter that retrieves documents *after* the cursor position
 * in descending order across an arbitrary set of sort fields.
 *
 * For N sort fields the filter expands to an $or of N+1 clauses, each handling
 * the case where the first k fields match exactly and the (k+1)-th field is
 * strictly less than the cursor value (since we are sorting descending).
 */
function descendingCursorFilter(cursor, fields) {
  const decoded = decodeCursor(cursor);
  if (!decoded) return null;

  const id = new mongoose.Types.ObjectId(decoded.id);
  // If no sort fields or a required field is missing, fall back to _id-only.
  if (!fields.length || fields.some((field) => decoded[field] === undefined)) {
    return { _id: { $lt: id } };
  }

  // Normalise raw values to their proper JS types (e.g. Date for createdAt).
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

  // Build composite range clauses for each sort field position.
  const clauses = [];
  for (let index = 0; index < fields.length; index += 1) {
    const clause = {};
    // All preceding fields must be equal.
    for (let equalIndex = 0; equalIndex < index; equalIndex += 1) {
      const equalField = fields[equalIndex];
      clause[equalField] = normalized[equalField];
    }
    // The current field uses a range bound (descending → $lt).
    const rangeField = fields[index];
    clause[rangeField] = { $lt: normalized[rangeField] };
    clauses.push(clause);
  }

  // Final clause: all sort fields equal exactly, but _id is strictly less.
  const exactFields = Object.fromEntries(
    fields.map((field) => [field, normalized[field]])
  );
  clauses.push({ ...exactFields, _id: { $lt: id } });
  return { $or: clauses };
}

/**
 * Build a MongoDB filter for ascending createdAt pagination.
 *
 * Documents are newer when createdAt is greater, or when createdAt is equal
 * and _id is greater (ties broken by insertion order).
 */
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

/**
 * Encode the cursor that should be returned to the client for the given
 * document.  Date values are serialised to ISO-8601 strings so they survive
 * a round-trip through JSON.
 */
function cursorForDocument(document, fields) {
  const values = { id: String(document._id) };
  for (const field of fields) {
    const value = document[field];
    values[field] = value instanceof Date ? value.toISOString() : value;
  }
  return encodeCursor(values);
}

/**
 * Trim the fetched result set to exactly `limit` items and attach a cursor
 * pointing at the last item (if there are more pages).
 *
 * Because the query fetches `limit + 1` documents, a result set longer than
 * `limit` indicates that a next page exists.
 */
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
