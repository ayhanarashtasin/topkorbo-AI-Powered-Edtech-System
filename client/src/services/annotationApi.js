/**
 * annotationApi.js
 *
 * Centralised client for every annotation REST endpoint. Resolves to the
 * inner `data` field of the standard server envelope `{ success, message,
 * data }` and throws `ApiError` on failure. Built on the shared
 * `httpClient` so auth + envelope handling stay in one place.
 */

import { httpClient } from './httpClient';

const { request, buildHeaders } = httpClient;

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
 * Default `annotationApi` namespace — re-export everything for callers
 * that prefer `annotationApi.bulkCreate(payload)`.
 */
export const annotationApi = {
  list: listAnnotations,
  create: createAnnotation,
  bulkCreate: bulkCreateAnnotations,
  bulkDelete: bulkDeleteAnnotations,
  remove: deleteAnnotation
};

// Re-export `ApiError` from the shared client for backward compatibility
// with callers that already imported it from this module.
export { ApiError } from './httpClient';

export default annotationApi;