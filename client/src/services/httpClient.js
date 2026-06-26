/**
 * httpClient.js
 *
 * Shared fetch wrapper for every REST endpoint in the app.
 *
 *   - Resolves to the inner `data` field of the standard server envelope
 *     `{ success, message, data }`.
 *   - Throws `ApiError` (with the server's `message` attached) when
 *     `success === false` or the HTTP response is not OK.
 *   - Reads the bearer token from `localStorage.topkorbo_token` to match
 *     the rest of the reader code (no shared HTTP client / interceptor in
 *     this codebase).
 *
 * Service modules (`annotationApi`, `aiApi`, …) build on top of this.
 */

const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Thrown by `request()` when the response is not OK or
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
  
  // Inject headers, including Authorization token
  init.headers = buildHeaders(init.headers);
  
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
    if (!res.ok) {
      throw new ApiError(res.statusText || 'Request failed', res.status, null);
    }
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

export const httpClient = { request, buildHeaders, ApiError };
export default httpClient;