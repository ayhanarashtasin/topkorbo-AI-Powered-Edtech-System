const POST_HTML_MAX = 50_000;
const COMMENT_HTML_MAX = 12_000;
const TAG_MAX = 40;
const TAG_COUNT_MAX = 8;

const CATEGORIES = new Set([
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'General',
  'Exam',
  'Assignment',
  'Other'
]);

function validateHtmlLength(value, maximum, label) {
  if (typeof value !== 'string' || !value.trim()) {
    return `${label} is required`;
  }
  if (value.length > maximum) {
    return `${label} is too long (maximum ${maximum.toLocaleString()} characters).`;
  }
  return null;
}

function normalizeTags(value) {
  return [...new Set(
    String(value || '')
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .map((tag) => tag.slice(0, TAG_MAX))
  )].slice(0, TAG_COUNT_MAX);
}

function normalizeCategory(value) {
  const category = String(value || 'General');
  return CATEGORIES.has(category) ? category : null;
}

module.exports = {
  POST_HTML_MAX,
  COMMENT_HTML_MAX,
  CATEGORIES,
  validateHtmlLength,
  normalizeTags,
  normalizeCategory
};
