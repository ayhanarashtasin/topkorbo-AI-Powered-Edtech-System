import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedAutoSave } from './useDebouncedAutoSave';
import { syncAnnotations } from '../services/annotationApi';

const DEFAULT_DELAY = 5000;

function createClientId() {
  if (globalThis.crypto?.randomUUID) return `c-${globalThis.crypto.randomUUID()}`;
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function operationKey(entry) {
  if (entry?.clientId) return entry.clientId;
  if (entry?._id) return `legacy:${entry._id}`;
  return null;
}

function storageKey(bookId, chapterId, pageNumber) {
  return `pendingAnnotations:v2:${bookId}:${chapterId}:${pageNumber}`;
}

function readStoredOperations(bookId, chapterId, pageNumber) {
  if (!bookId || !chapterId || !pageNumber) return [];
  try {
    const raw = sessionStorage.getItem(storageKey(bookId, chapterId, pageNumber));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((operation) => (
      operation?.clientId && (operation.kind === 'upsert' || operation.kind === 'delete')
    )) : [];
  } catch {
    return [];
  }
}

function publicStroke(stroke, clientId) {
  const id = stroke?._id && !String(stroke._id).startsWith('local-')
    ? String(stroke._id)
    : undefined;
  return {
    clientId,
    ...(id ? { id } : {}),
    type: 'pen',
    color: stroke.color,
    strokeWidth: stroke.strokeWidth,
    referenceWidth: stroke.referenceWidth,
    points: stroke.points
  };
}

function publicDelete(stroke, clientId) {
  const id = stroke?._id && !String(stroke._id).startsWith('local-')
    ? String(stroke._id)
    : undefined;
  return { clientId, ...(id ? { id } : {}) };
}

export function useAnnotationAutosave({
  bookId,
  chapterId,
  pageNumber,
  delay = DEFAULT_DELAY,
  onSaved,
  onError
}) {
  // A Map holds only the latest intent for each stable clientId. This makes
  // draw -> undo, erase -> undo, rapid partial erases, and retries converge.
  const queueRef = useRef(new Map());
  const durableInFlightRef = useRef(new Map());
  const inFlightRef = useRef(Promise.resolve());
  const fireRef = useRef(null);
  const savingCountRef = useRef(0);
  const retryTimerRef = useRef(0);
  const retryAttemptRef = useRef(0);
  const mountedRef = useRef(true);
  const contextKey = `${bookId}:${chapterId}:${pageNumber}`;
  const latestContextKeyRef = useRef(contextKey);
  const onSavedRef = useRef(onSaved);
  const onErrorRef = useRef(onError);
  const [pending, setPending] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const restoredOperations = useMemo(
    () => readStoredOperations(bookId, chapterId, pageNumber),
    [bookId, chapterId, pageNumber]
  );
  const restoredStrokes = useMemo(() => restoredOperations
    .filter((operation) => operation.kind === 'upsert' && operation.stroke)
    .map((operation) => ({
      ...operation.stroke,
      _id: `local-${operation.clientId}`,
      pageNumber
    })), [pageNumber, restoredOperations]);

  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { latestContextKeyRef.current = contextKey; }, [contextKey]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const persist = useCallback((operations = Array.from(queueRef.current.values())) => {
    if (!bookId || !chapterId || !pageNumber) return;
    try {
      const key = storageKey(bookId, chapterId, pageNumber);
      if (operations.length > 0) sessionStorage.setItem(key, JSON.stringify(operations));
      else sessionStorage.removeItem(key);
    } catch {
      // Storage may be unavailable in private browsing or during teardown.
    }
  }, [bookId, chapterId, pageNumber]);

  const updatePending = useCallback(() => {
    if (mountedRef.current) setPending(queueRef.current.size);
  }, []);

  const persistDurable = useCallback(() => {
    const latest = new Map(durableInFlightRef.current);
    for (const [clientId, operation] of queueRef.current) latest.set(clientId, operation);
    persist(Array.from(latest.values()));
  }, [persist]);

  const fire = useCallback(() => {
    if (!bookId || !chapterId || !pageNumber || queueRef.current.size === 0) {
      return inFlightRef.current;
    }

    const batch = Array.from(queueRef.current.values());
    for (const operation of batch) {
      if (queueRef.current.get(operation.clientId) === operation) {
        queueRef.current.delete(operation.clientId);
      }
      durableInFlightRef.current.set(operation.clientId, operation);
    }
    updatePending();

    // Persist before starting fetch. pagehide can terminate the request at any
    // point, and the next visit can safely replay this idempotent batch.
    persistDurable();
    savingCountRef.current += 1;
    if (mountedRef.current) {
      setSaving(true);
      setError(null);
    }

    const send = async () => {
      try {
        const result = await syncAnnotations({
          bookId,
          chapterId,
          pageNumber,
          upserts: batch.filter((operation) => operation.kind === 'upsert').map((operation) => operation.stroke),
          deletes: batch.filter((operation) => operation.kind === 'delete').map((operation) => operation.target)
        });
        for (const operation of batch) {
          if (durableInFlightRef.current.get(operation.clientId) === operation) {
            durableInFlightRef.current.delete(operation.clientId);
          }
        }
        persistDurable();
        if (mountedRef.current) {
          setLastSavedAt(Date.now());
          setError(null);
        }
        retryAttemptRef.current = 0;
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = 0;
        }
        try {
          onSavedRef.current?.(result?.annotations || [], result || {});
        } catch (callbackError) {
          console.error('Annotation reconciliation callback failed:', callbackError);
        }
      } catch (caught) {
        // A newer local intent wins over the failed batch's older intent.
        for (const operation of batch) {
          if (durableInFlightRef.current.get(operation.clientId) === operation) {
            durableInFlightRef.current.delete(operation.clientId);
          }
          if (!queueRef.current.has(operation.clientId) && !durableInFlightRef.current.has(operation.clientId)) {
            queueRef.current.set(operation.clientId, operation);
          }
        }
        persistDurable();
        updatePending();
        if (mountedRef.current) setError(caught);
        try {
          onErrorRef.current?.(caught);
        } catch (callbackError) {
          console.error('Annotation error callback failed:', callbackError);
        }
        const failedContextKey = `${bookId}:${chapterId}:${pageNumber}`;
        retryAttemptRef.current += 1;
        const retryDelay = Math.min(60000, delay * (2 ** Math.min(4, retryAttemptRef.current - 1)));
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = window.setTimeout(() => {
          retryTimerRef.current = 0;
          if (mountedRef.current && latestContextKeyRef.current === failedContextKey) fireRef.current?.();
        }, retryDelay);
        throw caught;
      } finally {
        savingCountRef.current = Math.max(0, savingCountRef.current - 1);
        if (mountedRef.current) setSaving(savingCountRef.current > 0);
      }
    };

    // Serialize batches so an older request can never overwrite a newer undo
    // or erase operation. A prior failure does not poison the chain.
    inFlightRef.current = inFlightRef.current.catch(() => undefined).then(send);
    return inFlightRef.current;
  }, [bookId, chapterId, delay, pageNumber, persistDurable, updatePending]);

  useEffect(() => { fireRef.current = fire; }, [fire]);

  const debounced = useDebouncedAutoSave(fire, delay);
  const schedule = useCallback(() => debounced.save(), [debounced]);

  const enqueue = useCallback((entry) => {
    if (!entry || entry.type !== 'pen' || !Array.isArray(entry.points)) return null;
    const clientId = operationKey(entry) || createClientId();
    queueRef.current.set(clientId, {
      kind: 'upsert',
      clientId,
      stroke: publicStroke(entry, clientId)
    });
    updatePending();
    schedule();
    return clientId;
  }, [schedule, updatePending]);

  const remove = useCallback((entry) => {
    const clientId = operationKey(entry);
    if (!clientId) return null;
    queueRef.current.set(clientId, {
      kind: 'delete',
      clientId,
      target: publicDelete(entry, clientId)
    });
    updatePending();
    schedule();
    return clientId;
  }, [schedule, updatePending]);

  const flush = useCallback(async () => {
    // This invokes fire synchronously if a timer exists; calling fire again is
    // intentional and harmless when the queue is already empty.
    debounced.flush();
    fire();
    try {
      await inFlightRef.current;
    } catch {
      // Error state and the durable queue communicate the failed save.
    }
  }, [debounced, fire]);

  useEffect(() => {
    queueRef.current = new Map();
    if (!bookId || !chapterId || !pageNumber) {
      updatePending();
      return;
    }
    try {
      for (const operation of restoredOperations) {
        queueRef.current.set(operation.clientId, operation);
      }
    } catch {
      queueRef.current = new Map();
    }
    updatePending();
    if (queueRef.current.size > 0) schedule();
  }, [bookId, chapterId, pageNumber, restoredOperations, schedule, updatePending]);

  useEffect(() => {
    const onPageHide = () => {
      persistDurable();
      try { debounced.flush(); } catch { /* best effort after durable stash */ }
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [debounced, persistDurable]);

  return { enqueue, remove, flush, schedule, pending, saving, error, lastSavedAt, restoredStrokes };
}

export default useAnnotationAutosave;
