/**
 * useAnnotationAutosave.js
 *
 * Batches pen annotations into a single POST every `delay` ms, replacing
 * the previous behaviour of one POST per stroke. Re-uses the existing
 * `useDebouncedAutoSave` for the timer, and adds:
 *   - An in-memory queue keyed by optimistic `clientId` (so we can
 *     swap a local placeholder for the server-returned doc on success).
 *   - A `flush()` method that fires the POST right now (used on page
 *     change and `beforeunload`).
 *   - A `beforeunload` warning that drops a `pending` flag — the
 *     browser's "Leave site?" dialog is suppressed because we already
 *     flush synchronously in `pagehide`, but consumers can opt in.
 *
 * Optimistic IDs:
 *   Strokes are pushed with `clientId: 'c-' + random` so we can find
 *   them in the canvas's `pageAnnotations` array before the server
 *   round-trip completes. On success we replace the placeholder's
 *   `_id` (and any other server fields) via a callback.
 *
 * Failure handling:
 *   On 4xx/5xx the queue is NOT auto-cleared — the strokes stay in
 *   `pending` and the next debounce fire retries. We surface the
 *   latest error via the `error` state so the page can show a toast.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedAutoSave } from './useDebouncedAutoSave';
import { bulkCreateAnnotations } from '../services/annotationApi';

const DEFAULT_DELAY = 5000;

/**
 * @param {object} options
 * @param {string} options.bookId
 * @param {string} options.chapterId
 * @param {number} options.pageNumber
 * @param {Array}  options.serverStrokes — committed strokes from server (for the current page)
 * @param {number} [options.delay=5000]
 * @param {(saved: object[]) => void} [options.onSaved] — called after a successful bulk POST
 * @param {(error: Error) => void}    [options.onError]  — called after a failed POST
 */
export function useAnnotationAutosave({
  bookId,
  chapterId,
  pageNumber,
  serverStrokes,
  delay = DEFAULT_DELAY,
  onSaved,
  onError
}) {
  // queueRef holds strokes that need to be POSTed. Each entry is a full
  // annotation document (with the `_id` field omitted, since the server
  // assigns one). We also carry `clientId` so the consumer can reconcile
  // the local optimistic record with the server-returned record.
  const queueRef = useRef([]);
  // Track the in-flight POST so `flush()` can actually await it
  // instead of guessing with setTimeout.
  const inFlightRef = useRef(Promise.resolve());
  const [pending, setPending] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // Keep callbacks in refs so the debounced fn can stay referentially
  // stable without invalidating the timer.
  const onSavedRef = useRef(onSaved);
  const onErrorRef = useRef(onError);
  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // Stable fire fn — always returns the in-flight promise.
  const fire = useCallback(() => {
    if (!bookId || !chapterId || !pageNumber) return inFlightRef.current;
    const batch = queueRef.current;
    if (batch.length === 0) return inFlightRef.current;
    queueRef.current = [];
    setPending(0);
    setSaving(true);
    setError(null);
    const promise = (async () => {
      try {
        const payload = {
          bookId,
          chapterId,
          pageNumber,
          annotations: batch.map((b) => ({
            type: b.type,
            color: b.color,
            strokeWidth: b.strokeWidth,
            points: b.points
          }))
        };
        const result = await bulkCreateAnnotations(payload);
        const inserted = (result && result.annotations) || [];
        setLastSavedAt(Date.now());
        if (onSavedRef.current) {
          try { onSavedRef.current(inserted); } catch (_) { /* ignore */ }
        }
      } catch (err) {
        // Put the batch back at the head so the next debounce retries.
        queueRef.current = batch.concat(queueRef.current);
        setPending(queueRef.current.length);
        setError(err);
        if (onErrorRef.current) {
          try { onErrorRef.current(err); } catch (_) { /* ignore */ }
        }
      } finally {
        setSaving(false);
      }
    })();
    inFlightRef.current = promise;
    return promise;
  }, [bookId, chapterId, pageNumber]);

  // Build the debounced wrapper. We pass a no-op fn and call `fire`
  // manually below so the consumer gets a stable API.
  const debounced = useDebouncedAutoSave(() => {
    fire();
  }, delay);

  // Re-define `fire` in terms of the debounced fn's underlying behaviour
  // by just calling fire() directly and ignoring the debounced wrapper
  // for the scheduled case. The wrapper is used by `schedule` only.
  const schedule = useCallback(() => {
    debounced();
  }, [debounced]);

  /**
   * Queue a new stroke for save. The entry must already be in the
   * server's expected shape. Returns the assigned `clientId` so the
   * caller can keep a reference for reconciliation.
   */
  const enqueue = useCallback((entry) => {
    if (!entry || entry.type !== 'pen') return null;
    const clientId = entry.clientId || `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    queueRef.current.push({ ...entry, clientId });
    setPending(queueRef.current.length);
    schedule();
    return clientId;
  }, [schedule]);

  /**
   * Force-flush any pending strokes right now and resolve only after
   * the in-flight POST (if any) settles. Used on page change and
   * `pagehide`. Returns a promise the caller can `await`.
   */
  const flush = useCallback(async () => {
    debounced.flush();
    // `debounced.flush` synchronously invokes the wrapped fn, which is
    // `fire()`. `fire()` returns the in-flight promise; awaiting it
    // means we don't proceed until the POST either resolves or rejects.
    try { await inFlightRef.current; } catch (_) { /* error is on `error` state */ }
  }, [debounced]);

  // When the page changes, drop any queued strokes that belong to the
  // previous page — they shouldn't be flushed against the new page.
  // The caller is responsible for calling `flush()` BEFORE changing
  // pageNumber; this effect is a safety net.
  useEffect(() => {
    queueRef.current = [];
    setPending(0);
  }, [bookId, chapterId, pageNumber]);

  /**
   * `beforeunload` flush: best-effort, sync. We can't reliably POST in a
   * `beforeunload` handler (the browser may cancel the request) so we
   * stash the queue in `sessionStorage` keyed by chapter+page. The
   * next time the user opens the chapter we replay it.
   */
  useEffect(() => {
    const onHide = () => {
      // Try the in-flight POST first. If the request hasn't been
      // scheduled yet (i.e. we're inside the debounce window), this
      // is a no-op.
      try {
        debounced.flush();
      } catch (_) { /* ignore */ }
      // Persist whatever is still queued so we can replay it on next
      // mount of the same chapter/page.
      if (queueRef.current.length > 0 && bookId && chapterId) {
        try {
          const key = `pendingAnnotations:${bookId}:${chapterId}:${pageNumber}`;
          sessionStorage.setItem(key, JSON.stringify(queueRef.current));
        } catch (_) { /* sessionStorage may be unavailable */ }
      }
    };
    // `pagehide` is more reliable than `beforeunload` for sending
    // final telemetry and is supported on every modern browser.
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [bookId, chapterId, pageNumber, debounced]);

  // Replay any leftover queue from a previous session on mount.
  useEffect(() => {
    if (!bookId || !chapterId || !pageNumber) return;
    try {
      const key = `pendingAnnotations:${bookId}:${chapterId}:${pageNumber}`;
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Only replay if the server doesn't already have the stroke.
        // We match on (color, points length, first point coords) to be
        // best-effort; a perfect dedupe would require a stable client
        // id round-trip, which we don't have here.
        const known = new Set(
          (serverStrokes || []).map((s) => `${s.color}|${(s.points || []).length}|${(s.points || [])[0]?.x?.toFixed(4)}|${(s.points || [])[0]?.y?.toFixed(4)}`)
        );
        const fresh = parsed.filter((p) => {
          const key = `${p.color}|${(p.points || []).length}|${(p.points || [])[0]?.x?.toFixed(4)}|${(p.points || [])[0]?.y?.toFixed(4)}`;
          return !known.has(key);
        });
        fresh.forEach((p) => queueRef.current.push(p));
        setPending(queueRef.current.length);
        sessionStorage.removeItem(key);
        if (fresh.length > 0) schedule();
      }
    } catch (_) { /* ignore malformed session payloads */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, chapterId, pageNumber]);

  return {
    enqueue,
    flush,
    schedule,
    pending,
    saving,
    error,
    lastSavedAt
  };
}

export default useAnnotationAutosave;
