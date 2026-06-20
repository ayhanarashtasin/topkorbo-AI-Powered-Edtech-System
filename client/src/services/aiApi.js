/**
 * aiApi.js
 *
 * Client for the AI tutor endpoints. Built on the shared `httpClient` so
 * auth, headers, and the `{ success, data }` envelope are handled in one
 * place.
 */

import { httpClient } from './httpClient';

const { request, buildHeaders, ApiError } = httpClient;

/**
 * Ask the AI tutor a question. The server reads `pageText` from the
 * request body and forwards it as context to the LLM.
 *
 * @param {{ bookId: string, chapterId: string, pageNumber: number, question: string, pageText?: string }} payload
 * @returns {Promise<{ reply: string, userMessage: object, assistantMessage: object }>}
 */
export function sendMessage(payload) {
  return request('/ai/chat', {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
}

/**
 * Load chat history for a chapter, optionally filtered to a single page.
 *
 * @param {{ chapterId: string, pageNumber?: number }} params
 * @returns {Promise<{ messages: object[] }>}
 */
export function getHistory({ chapterId, pageNumber } = {}) {
  const qs = new URLSearchParams();
  if (chapterId) qs.set('chapterId', chapterId);
  if (pageNumber) qs.set('pageNumber', String(pageNumber));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request(`/ai/history${suffix}`, {
    headers: buildHeaders()
  });
}

/**
 * Delete chat history. Pass `pageNumber` to clear one page, omit it to
 * clear the entire chapter.
 *
 * @param {{ chapterId: string, pageNumber?: number }} params
 * @returns {Promise<{ deletedCount: number }>}
 */
export function clearHistory({ chapterId, pageNumber } = {}) {
  const qs = new URLSearchParams();
  if (chapterId) qs.set('chapterId', chapterId);
  if (pageNumber) qs.set('pageNumber', String(pageNumber));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request(`/ai/history${suffix}`, {
    method: 'DELETE',
    headers: buildHeaders()
  });
}

/**
 * Ask the AI to convert a question (typed or as an image) into a structured
 * LaTeX representation. Used by the standalone AI Question Helper page —
 * the result is throwaway formatting work and is not persisted server-side.
 *
 * @param {{ text?: string, imageBase64?: string, mimeType?: string }} payload
 * @returns {Promise<{ extracted: { questionText: string, options: {label:string,text:string}[], correctOption: string|null, solution: string } }>}
 */
export function extractQuestion(payload) {
  return request('/ai/extract-question', {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
}

export const aiApi = {
  send: sendMessage,
  history: getHistory,
  clear: clearHistory,
  extract: extractQuestion
};

// Re-export `ApiError` so callers can `import { ApiError } from '../services/aiApi'`.
export { ApiError };

export default aiApi;
