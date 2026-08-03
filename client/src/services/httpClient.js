import { notifyPaywall } from '../utils/paywall';

const API_BASE = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');
const DEFAULT_TIMEOUT_MS = 15000;
const SLOW_REQUEST_MS = 2500;
const SAFE_RETRY_COUNT = 2;
const SAFE_METHODS = new Set(['GET', 'HEAD']);
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
const BACKEND_WAITING_MESSAGE = 'Starting server... this may take up to 60 seconds on free hosting.';
const BACKEND_DELAYED_MESSAGE = 'Server is taking longer than expected. Please refresh in a moment.';
const BACKEND_STATUS_EVENT = 'topkorbo:backend-status';

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

let slowRequestCount = 0;

function emitBackendStatus(state, message = '') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(BACKEND_STATUS_EVENT, {
      detail: { state, message }
    })
  );
}

function beginSlowRequest() {
  slowRequestCount += 1;
  emitBackendStatus('waiting', BACKEND_WAITING_MESSAGE);
}

function endSlowRequest() {
  slowRequestCount = Math.max(0, slowRequestCount - 1);
  if (slowRequestCount === 0) {
    emitBackendStatus('ready');
  }
}

function getToken() {
  try {
    return localStorage.getItem('topkorbo_token');
  } catch {
    return null;
  }
}

function buildHeaders(extra, init = {}) {
  const headers = { ...(extra || {}) };
  if (!headers['Content-Type'] && init.body && !(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(err) {
  return err?.name === 'AbortError';
}

function isSafeMethod(method) {
  return SAFE_METHODS.has((method || 'GET').toUpperCase());
}

function shouldRetryResponse(res, payload, safeRequest) {
  if (!safeRequest) return false;
  if (RETRYABLE_STATUS_CODES.has(res.status)) return true;
  return payload?.message === 'Service temporarily unavailable — database not ready.';
}

function createNetworkError(message = BACKEND_DELAYED_MESSAGE) {
  emitBackendStatus('error', BACKEND_DELAYED_MESSAGE);
  return new ApiError(message, 0, null);
}

async function performFetch(url, fetchInit, timeoutMs, showSlowMessage) {
  const controller = new AbortController();
  const requestInit = { ...fetchInit, signal: controller.signal };
  let slowStarted = false;

  const slowTimer = showSlowMessage
    ? setTimeout(() => {
        slowStarted = true;
        beginSlowRequest();
      }, SLOW_REQUEST_MS)
    : null;

  const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, requestInit);
    return response;
  } finally {
    clearTimeout(timeoutTimer);
    if (slowTimer) clearTimeout(slowTimer);
    if (slowStarted) endSlowRequest();
  }
}

async function request(path, init = {}) {
  const url = `${API_BASE}${path}`;
  const method = (init.method || 'GET').toUpperCase();
  const safeRequest = isSafeMethod(method);
  const retryCount = Number.isInteger(init.retryCount) ? init.retryCount : (safeRequest ? SAFE_RETRY_COUNT : 0);
  const retryDelayMs = Number.isFinite(init.retryDelayMs) ? init.retryDelayMs : 1500;
  const timeoutMs = Number.isFinite(init.timeoutMs) ? init.timeoutMs : DEFAULT_TIMEOUT_MS;
  const showSlowMessage = init.showSlowMessage !== false;
  const fetchInit = { ...init };

  delete fetchInit.retryCount;
  delete fetchInit.retryDelayMs;
  delete fetchInit.timeoutMs;
  delete fetchInit.showSlowMessage;

  fetchInit.headers = buildHeaders(fetchInit.headers, fetchInit);

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    let res;
    try {
      res = await performFetch(url, fetchInit, timeoutMs, showSlowMessage);
    } catch (err) {
      const timedOut = isAbortError(err);
      const canRetry = safeRequest && attempt < retryCount;

      if (canRetry) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      throw createNetworkError(timedOut ? BACKEND_DELAYED_MESSAGE : BACKEND_DELAYED_MESSAGE);
    }

    let payload;
    try {
      payload = await res.json();
    } catch {
      if (!res.ok) {
        if (shouldRetryResponse(res, null, safeRequest) && attempt < retryCount) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }
        throw new ApiError(res.statusText || 'Request failed', res.status, null);
      }
      return null;
    }

    if (shouldRetryResponse(res, payload, safeRequest) && attempt < retryCount) {
      await sleep(retryDelayMs * (attempt + 1));
      continue;
    }

    if (!res.ok || (payload && payload.success === false)) {
      notifyPaywall(payload);
      throw new ApiError(
        (payload && (payload.message || payload.data?.message)) || res.statusText || 'Request failed',
        res.status,
        payload
      );
    }

    return (payload && payload.data) ?? null;
  }

  throw createNetworkError(BACKEND_DELAYED_MESSAGE);
}

function warmupBackend(options = {}) {
  return request('/health', {
    retryCount: 2,
    timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    retryDelayMs: options.retryDelayMs || 1500,
    showSlowMessage: options.showSlowMessage !== false
  });
}

export const httpClient = {
  request,
  buildHeaders,
  warmupBackend,
  ApiError,
  BACKEND_STATUS_EVENT,
  BACKEND_WAITING_MESSAGE,
  BACKEND_DELAYED_MESSAGE
};
export default httpClient;
