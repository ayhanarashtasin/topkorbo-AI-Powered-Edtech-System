// Normalizes user-supplied text for consistent search matching.
// Handles Unicode diacritics (e.g. é -> e), collapses whitespace,
// and lowercases to ensure "Café" matches "cafe" in the database.
function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKD')                          // Decompose accented characters into base + mark
    .replace(/[\u0300-\u036f]/g, '')            // Strip the combining diacritical marks
    .toLocaleLowerCase('en-US')                 // Lowercase for case-insensitive matching
    .replace(/\s+/g, ' ')                       // Collapse multiple whitespace into single space
    .trim();
}

// Escapes special regex characters in user input so it can be safely
// used in a RegExp constructor without unintended pattern matching.
// Without this, a query like "C++" would throw an invalid regex error.
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { normalizeSearchText, escapeRegex };
