const sanitizeHtml = require('sanitize-html');

const ALLOWED_TAGS = [
  'b',
  'i',
  'em',
  'strong',
  'u',
  's',
  'p',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'a',
  'span'
];

const sanitizeOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'data-uid', 'class'],
    span: ['class', 'data-uid'],
    code: ['class']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: (tagName, attribs) => {
      const out = { ...attribs };
      // Force-safe links
      out.target = out.target || '_blank';
      out.rel = 'noopener noreferrer nofollow';
      if (out.class === 'mention') {
        // @mention stays as a span-like link, mark class
        out['data-uid'] = out['data-uid'] || '';
      }
      return { tagName: 'a', attribs: out };
    }
  },
  // Disallow everything else
  disallowedTagsMode: 'discard'
};

function sanitize(html) {
  if (!html || typeof html !== 'string') return '';
  return sanitizeHtml(html, sanitizeOptions);
}

/**
 * Extract a plain-text preview from HTML for notifications / search.
 * Strips tags, collapses whitespace, truncates to `max` chars.
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