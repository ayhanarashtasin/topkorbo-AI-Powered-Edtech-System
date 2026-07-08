const AUTH_KEYS = [
  'topkorbo_token',
  'topkorbo_name',
  'topkorbo_avatar',
  'topkorbo_email',
  'topkorbo_role',
  'topkorbo_forum_role',
  'topkorbo_guest'
];

export function getAuthToken() {
  return localStorage.getItem('topkorbo_token');
}

export function getCachedForumRole() {
  return localStorage.getItem('topkorbo_forum_role') || 'user';
}

export function syncUserStorage(user) {
  if (!user) return;

  if (user.name) localStorage.setItem('topkorbo_name', user.name);
  if (typeof user.avatar === 'string') localStorage.setItem('topkorbo_avatar', user.avatar);
  if (user.email) localStorage.setItem('topkorbo_email', user.email);
  if (user.role) localStorage.setItem('topkorbo_role', user.role);
  if (user.forumRole) localStorage.setItem('topkorbo_forum_role', user.forumRole);
}

export function clearAuthStorage() {
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
}
