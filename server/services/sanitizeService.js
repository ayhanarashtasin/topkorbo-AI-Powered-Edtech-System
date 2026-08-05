const sanitizeHtml = require('sanitize-html');

/**
 * Server-side HTML sanitizer for user-generated content.
 * Strips potentially dangerous markup (scripts, event handlers) while
 * preserving safe formatting tags needed for rich text display.
 * Used to sanitize HTML before storage and before sending to clients.
 */

// Whitelist of safe formatting tags. These cover basic text styling,
// lists, block quotes, and code blocks without enabling structural
// or interactive HTML that could be exploited.
const ALLOWED_TAGS = [
  'b',       // Bold text
  'i',       // Italic text
  'em',      // Emphasis (semantically equivalent to italic)
  'strong',  // Strong importance (semantically equivalent to bold)
  'u',       // Underline
  's',       // Strikethrough
  'p',       // Paragraphs
  'br',      // Line breaks
  'hr',      // Horizontal rules (section dividers)
  'ul',      // Unordered lists
  'ol',      // Ordered lists
  'li',      // List items
  'blockquote', // Block quotations
  'pre',     // Preformatted text (preserves whitespace)
  'code',    // Inline code snippets
  'a',       // Hyperlinks
  'span'     // Inline containers (used for mentions, styling)
];

const sanitizeOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'data-uid', 'class'],
    span: ['class', 'data-uid'],
    code: ['class']
  },
  // Restrict link protocols to prevent javascript: and data: URI attacks
  allowedSchemes: ['http', 'https', 'mailto'],
  // Transform tags to enforce security defaults and preserve mention metadata
  transformTags: {
    a: (tagName, attribs) => {
      const out = { ...attribs };
      // Force links to open in new tab to prevent navigation away from app
      out.target = out.target || '_blank';
      // Prevent reverse tabnapping and prevent search engine crawling of links
      out.rel = 'noopener noreferrer nofollow';
      if (out.class === 'mention') {
        // Preserve @mention data-uid for client-side user profile linking
        out['data-uid'] = out['data-uid'] || '';
      }
      return { tagName: 'a', attribs: out };
    }
  },
  // Silently remove any tags not in the whitelist rather than escaping them
  disallowedTagsMode: 'discard'
};

function sanitize(html) {
  if (!html || typeof html !== 'string') return '';
  return sanitizeHtml(html, sanitizeOptions);
}

/**
 * Extract a plain-text preview from HTML for notifications / search.
 * Strips all tags, collapses whitespace, truncates to `max` chars.
 */
function htmlToText(html, max = 240) {
  if (!html) return '';
  const stripped = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length <= max) return stripped;
  return stripped.slice(0, max - 1) + '…';
}

module.exports = { sanitize, htmlToText };
