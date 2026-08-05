/**
 * Forum Validation Utilities
 *
 * Shared constants and helper functions for validating and normalizing
 * forum post and comment data before persistence. These enforce size
 * limits to prevent abuse, normalize user input for consistency, and
 * validate categorical values against allowed sets.
 */

// --- Size Limits ---
// Posts allow longer content (articles, assignments); comments are shorter.
const POST_HTML_MAX = 50_000;
const COMMENT_HTML_MAX = 12_000;

// Individual tag length cap and maximum number of tags per post.
// Prevents spam tags and keeps tag lists manageable.
const TAG_MAX = 40;
const TAG_COUNT_MAX = 8;

// Allowed post categories. Using a Set for O(1) lookup during validation.
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

/**
 * Validates that an HTML string is non-empty and within the character limit.
 * Returns null on success, or a human-readable error message on failure.
 *
 * @param {*} value      - The input to validate
 * @param {number} maximum - Maximum allowed character count
 * @param {string} label   - Field name for error messages (e.g. "Post content")
 * @returns {string|null}  - Error message or null
 */
function validateHtmlLength(value, maximum, label) {
  if (typeof value !== 'string' || !value.trim()) {
    return `${label} is required`;
  }
  if (value.length > maximum) {
    return `${label} is too long (maximum ${maximum.toLocaleString()} characters).`;
  }
  return null;
}

/**
 * Normalizes a comma-separated tag string into a deduplicated, lowercased
 * array with length and count limits applied.
 *
 * Steps: split → trim → lowercase → remove empties → truncate each tag →
 *        deduplicate → cap total count.
 *
 * @param {string} value - Comma-separated tags from client
 * @returns {string[]}   - Cleaned, deduplicated tag array
 */
function normalizeTags(value) {
  return [...new Set(
    String(value || '')
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .map((tag) => tag.slice(0, TAG_MAX))
  )].slice(0, TAG_COUNT_MAX);
}

/**
 * Validates a category string against the allowed CATEGORIES set.
 * Returns the valid category or null if invalid.
 *
 * @param {string} value - Category from client
 * @returns {string|null} - Valid category name or null
 */
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
