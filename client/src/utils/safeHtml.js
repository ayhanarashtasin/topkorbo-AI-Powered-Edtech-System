import DOMPurify from 'dompurify';

/**
 * Centralised client-side HTML sanitizer.
 *
 * Several views build HTML strings by interpolating user/teacher/AI text into
 * markup (KaTeX math, lightweight markdown) and inject them via
 * `dangerouslySetInnerHTML`. The interpolated text is NOT escaped by those
 * builders, so a payload like `<img src=x onerror=alert(document.cookie)>` in a
 * question option or AI response would execute and could steal the JWT from
 * localStorage. Running the final string through DOMPurify strips scripts,
 * event handlers, and other active content while preserving KaTeX output
 * (HTML + MathML) and the safe formatting tags these views rely on.
 *
 * Use `renderSafeHtml(html)` to get the `{ __html }` object that
 * `dangerouslySetInnerHTML` expects.
 */
const SANITIZE_CONFIG = {
  // Keep KaTeX's HTML + MathML output and the inline formatting these renderers
  // produce. DOMPurify still removes <script>, event-handler attributes, and
  // javascript:/data: URLs regardless of what is allowed here.
  USE_PROFILES: { html: true, mathMl: true, svg: true },
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick']
};

export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

/**
 * Convenience wrapper returning the object shape used by
 * `dangerouslySetInnerHTML={...}`.
 */
export function renderSafeHtml(html) {
  return { __html: sanitizeHtml(html) };
}

export default sanitizeHtml;
