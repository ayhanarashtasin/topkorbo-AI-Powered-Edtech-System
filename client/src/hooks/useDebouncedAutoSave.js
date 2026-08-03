import { useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * Debounce a save callback. Useful for autosave flows that fire on every
 * keystroke / pointer move (e.g. pen strokes, page changes, bookmark adds).
 *
 *   const { save } = useDebouncedAutoSave((value) => api.save(value), 800);
 *   save(nextValue);
 *
 * The latest call wins; in-flight saves are not aborted (the caller owns its
 * own race-condition handling, e.g. a request id).
 */
export function useDebouncedAutoSave(fn, delay = 800) {
  const fnRef = useRef(fn);
  const timerRef = useRef(null);
  const pendingValueRef = useRef(undefined);
  const hasPendingRef = useRef(false);

  // Keep the latest fn without restarting the timer.
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  // Flush any pending save synchronously on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (hasPendingRef.current) {
        try {
          fnRef.current(pendingValueRef.current);
        } catch (err) {
          // Swallow on unmount; nothing useful to do with the error here.
          console.error('DebouncedAutoSave flush on unmount failed:', err);
        }
        hasPendingRef.current = false;
      }
    };
  }, []);

  const schedule = useCallback((value) => {
    pendingValueRef.current = value;
    hasPendingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      hasPendingRef.current = false;
      const v = pendingValueRef.current;
      try {
        fnRef.current(v);
      } catch (err) {
        console.error('DebouncedAutoSave failed:', err);
      }
    }, delay);
  }, [delay]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (hasPendingRef.current) {
      hasPendingRef.current = false;
      const v = pendingValueRef.current;
      try {
        fnRef.current(v);
      } catch (err) {
        console.error('DebouncedAutoSave flush failed:', err);
      }
    }
  }, []);

  return useMemo(() => ({ save: schedule, flush }), [flush, schedule]);
}

export default useDebouncedAutoSave;
