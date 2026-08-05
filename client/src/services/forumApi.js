/**
 * API client for all forum/community endpoints.
 *
 * Wraps fetch with automatic auth-token injection, consistent error handling,
 * and support for both JSON and FormData requests. Every method returns the
 * standard `{ success, data, nextCursor, unreadCount }` envelope from the
 * server. On failure, it throws an Error with `.status` and `.payload` so
 * callers can distinguish 401/403/404/500 responses in try/catch blocks.
 */
// Base URL: in production the Vite proxy or same-origin serves /api, in
// development the explicit localhost URL avoids CORS issues during HMR.
const DEFAULT_BASE = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

function token() {
  return localStorage.getItem('topkorbo_token');
}

/**
 * Core request helper. Handles auth headers, content-type negotiation,
 * and normalizes the server's JSON response into the expected envelope.
 * Non-OK responses are thrown as errors with status and payload attached.
 */
async function request(path, { method = 'GET', body, headers = {}, isForm = false } = {}) {
  const url = path.startsWith('http') ? path : `${DEFAULT_BASE}${path}`;
  const init = {
    method,
    headers: {
      Accept: 'application/json',
      ...headers
    }
  };
  const t = token();
  if (t) init.headers.Authorization = `Bearer ${t}`;

  if (body !== undefined) {
    if (isForm) {
      // Caller already built a FormData instance — pass it through verbatim.
      init.body = body;
    } else if (body instanceof URLSearchParams) {
      init.body = body;
      init.headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
    } else {
      init.body = JSON.stringify(body);
      init.headers['Content-Type'] = 'application/json';
    }
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Server returned non-JSON (${res.status})`);
  }
  if (!res.ok || json.success === false) {
    const err = new Error(json.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

const forumApi = {
  feed({ feed = 'latest', category, cursor, limit } = {}) {
    const qs = new URLSearchParams();
    qs.set('feed', feed);
    if (category && category !== 'All') qs.set('category', category);
    if (cursor) qs.set('cursor', cursor);
    if (limit) qs.set('limit', String(limit));
    return request(`/posts?${qs.toString()}`);
  },
  getPost(id) {
    return request(`/posts/${id}`);
  },
  createPost({ contentHtml, title, category, type, tags, images = [] }) {
    const form = new FormData();
    form.append('contentHtml', contentHtml);
    if (title) form.append('title', title);
    form.append('category', category || 'General');
    form.append('type', type || 'text');
    if (tags) form.append('tags', tags);
    for (const file of images) form.append('images', file);
    return request('/posts', { method: 'POST', body: form, isForm: true });
  },
  updatePost(id, patch) {
    const form = new FormData();
    for (const field of ['contentHtml', 'title', 'category', 'type', 'tags']) {
      if (patch[field] !== undefined) form.append(field, patch[field]);
    }
    if (patch.keepImages !== undefined) {
      form.append('keepImages', JSON.stringify(patch.keepImages));
    }
    for (const file of patch.images || []) form.append('images', file);
    return request(`/posts/${id}`, { method: 'PATCH', body: form, isForm: true });
  },
  deletePost(id) {
    return request(`/posts/${id}`, { method: 'DELETE' });
  },
  toggleBookmark(id) {
    return request(`/posts/${id}/bookmark`, { method: 'POST' });
  },
  postsByUser(userId, cursor) {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return request(`/users/${userId}/posts${qs}`);
  },
  myBookmarks({ cursor, limit } = {}) {
    const qs = new URLSearchParams();
    if (cursor) qs.set('cursor', cursor);
    if (limit) qs.set('limit', String(limit));
    const q = qs.toString();
    return request(`/posts/bookmarks/mine${q ? `?${q}` : ''}`);
  },

  // --- Comments ---
  comments(postId, cursor) {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return request(`/posts/${postId}/comments${qs}`);
  },
  createComment(postId, { contentHtml, parentId, images = [] }) {
    const form = new FormData();
    form.append('contentHtml', contentHtml);
    if (parentId) form.append('parentId', parentId);
    for (const file of images) form.append('images', file);
    return request(`/posts/${postId}/comments`, { method: 'POST', body: form, isForm: true });
  },
  updateComment(id, { contentHtml }) {
    return request(`/comments/${id}`, { method: 'PATCH', body: { contentHtml } });
  },
  deleteComment(id) {
    return request(`/comments/${id}`, { method: 'DELETE' });
  },

  // --- Reactions ---
  toggleReaction({ targetType, target, type }) {
    return request('/reactions', { method: 'POST', body: { targetType, target, type } });
  },

  // --- Notifications ---
  notifications({ limit, cursor, before } = {}) {
    const qs = new URLSearchParams();
    if (limit) qs.set('limit', String(limit));
    if (cursor) qs.set('cursor', cursor);
    if (before) qs.set('before', before);
    const q = qs.toString();
    return request(`/notifications${q ? `?${q}` : ''}`);
  },
  markNotificationRead(id) {
    return request(`/notifications/${id}/read`, { method: 'PATCH' });
  },
  markAllNotificationsRead() {
    return request('/notifications/read-all', { method: 'POST' });
  },

  // --- Search / Categories ---
  categories() {
    return request('/search/categories');
  },
  search(q, type = 'all') {
    const qs = new URLSearchParams({ q, type });
    return request(`/search?${qs.toString()}`);
  },

  // --- Users / Follow ---
  me() {
    return request('/users/me');
  },
  getUser(id) {
    return request(`/users/${id}`);
  },
  updateMe(patch) {
    const form = new FormData();
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined && v !== null) form.append(k, v);
    }
    return request('/users/me', { method: 'PATCH', body: form, isForm: true });
  },
  follow(id) {
    return request(`/users/${id}/follow`, { method: 'POST' });
  },
  unfollow(id) {
    return request(`/users/${id}/follow`, { method: 'DELETE' });
  },
  followState(id) {
    return request(`/users/${id}/follow-state`);
  },

  // --- Reports / Moderation ---
  report({ targetType, target, reason, description }) {
    return request('/reports', { method: 'POST', body: { targetType, target, reason, description } });
  }
};

export default forumApi;
