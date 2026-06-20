// Global test setup. Importing @testing-library/jest-dom adds custom
// matchers like `toBeInTheDocument`. We also shim `crypto.randomUUID`
// in jsdom (older versions of jsdom don't provide it) and polyfill
// `PointerEvent` (jsdom 25 still doesn't ship it).
import '@testing-library/jest-dom/vitest';

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {};
}
if (typeof globalThis.crypto.randomUUID !== 'function') {
  let counter = 0;
  globalThis.crypto.randomUUID = () => {
    counter += 1;
    return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
  };
}

// Minimal PointerEvent polyfill for jsdom. React 19 + modern browsers
// use PointerEvent; jsdom doesn't implement it, but the underlying
// dispatch mechanics still work with a regular Event that carries the
// pointer-specific properties as own props.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params);
      // MouseEvent's clientX/clientY are getters only; defineProperty
      // lets us set them on this instance.
      try {
        Object.defineProperty(this, 'pointerId', { value: params.pointerId ?? 1, configurable: true });
        Object.defineProperty(this, 'pointerType', { value: params.pointerType ?? 'mouse', configurable: true });
        Object.defineProperty(this, 'isPrimary', { value: params.isPrimary ?? true, configurable: true });
        Object.defineProperty(this, 'clientX', { value: params.clientX ?? 0, configurable: true });
        Object.defineProperty(this, 'clientY', { value: params.clientY ?? 0, configurable: true });
      } catch (_) { /* best-effort */ }
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill;
}
