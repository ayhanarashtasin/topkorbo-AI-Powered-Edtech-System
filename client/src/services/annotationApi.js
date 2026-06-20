/**
 * annotationApi.js
 *
 * Centralised client for every annotation REST endpoint.
 *
 * Every method resolves to the inner `data` field of the standard server
 * envelope `{ success, message, data }` and throws an `ApiError` (with the
 * server's `message` attached) when `success === false` or the HTTP
 * response is not OK.
 *
 * Auth: reads the bearer token from `localStorage.topkorbo_token` to match
 * the rest of the reader code (no shared HTTP client / interceptor in this
 * codebase).
 */

const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Thrown by every method in this module when the response is not OK or
 * `success === false`. Carries the server's message (if any) and the HTTP
 * status so callers can choose to surface a toast or silently roll back.
 */
export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function getToken() {
  try {
    return localStorage.getItem('topkorbo_token');
  } catch (_) {
    return null;
  }
}

function buildHeaders(extra) {
  const headers = { ...(extra || {}) };
  if (!headers['Content-Type'] && headers.body) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function request(path, init = {}) {
  const url = `${API_BASE}${path}`;
  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    // Network / CORS / offline — surface as an ApiError so callers can
    // distinguish it from server errors.
    throw new ApiError(err?.message || 'Network error', 0, null);
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch (_) {
    // Non-JSON response (shouldn't happen for these endpoints, but be
    // defensive). Use the HTTP status to fabricate an envelope.
    if (!res.ok) throw new ApiError(res.statusText || 'Request failed', res.status, null);
    return null;
  }

  if (!res.ok || (payload && payload.success === false)) {
    throw new ApiError(
      (payload && payload.message) || res.statusText || 'Request failed',
      res.status,
      payload
    );
  }
  return (payload && payload.data) ?? null;
}

/**
 * Get all annotations for a chapter (optionally filtered to a single page).
 *
 * @param {string} chapterId
 * @param {number|string} [page] — when present, restricts to that page
 * @returns {Promise<{annotations: object[], total: number}>}
 */
export function listAnnotations(chapterId, page) {
  const qs = new URLSearchParams({ chapterId });
  if (page) qs.set('page', String(page));
  return request(`/books/annotations?${qs.toString()}`, {
    headers: buildHeaders()
  });
}

/**
 * Create a single annotation. Mainly kept for highlights/markers; pen
 * strokes go through `bulkCreate` so we amortise network round-trips.
 *
 * @param {object} payload — see backend createAnnotation
 */
export function createAnnotation(payload) {
  return request('/books/annotations', {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
}

/**
 * Bulk-create annotations for a single page. Used by the autosave
 * pipeline to POST N strokes at once. The server validates every entry
 * and returns the inserted docs.
 *
 * @param {{ bookId, chapterId, pageNumber, annotations: object[] }} payload
 * @returns {Promise<{annotations: object[], insertedCount: number}>}
 */
export function bulkCreateAnnotations(payload) {
  return request('/books/annotations/bulk', {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
}

/**
 * Bulk-delete annotations by id. Used by undo-of-erase flows and large
 * history rollbacks. The server enforces ownership (`userId` match) so a
 * client cannot delete someone else's annotation even with a forged id.
 *
 * @param {string[]} ids
 */
export function bulkDeleteAnnotations(ids) {
  return request('/books/annotations/bulk-delete', {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ids })
  });
}

/**
 * Delete a single annotation (owner only on the server).
 * @param {string} id
 */
export function deleteAnnotation(id) {
  return request(`/books/annotations/${id}`, {
    method: 'DELETE',
    headers: buildHeaders()
  });
}

/**
 * The default `annotationApi` object — re-export everything as a namespace
 * for callers that prefer `annotationApi.bulkCreate(payload)`. The named
 * exports above are also exported for tree-shaking.
 */
export const annotationApi = {
  list: listAnnotations,
  create: createAnnotation,
  bulkCreate: bulkCreateAnnotations,
  bulkDelete: bulkDeleteAnnotations,
  remove: deleteAnnotation
};

export default annotationApi;
