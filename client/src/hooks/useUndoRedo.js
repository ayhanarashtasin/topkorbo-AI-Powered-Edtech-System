/**
 * useUndoRedo.js
 *
 * A per-page command stack with O(1) memory growth (we store actions,
 * not snapshots) and Ctrl+Z / Ctrl+Y keyboard support.
 *
 * Mental model:
 *   - "present" is the list of annotations for the current page.
 *   - An action is `{ do(state), undo(state), label }`. Pushing
 *     applies `do`; `undo()` pops and applies `undo`; `redo()` pops
 *     and re-applies `do`.
 *   - History is "per-page, in-memory only" — the consumer calls
 *     `reset(initialAnnotations)` when the page number changes.
 *
 * Why actions, not snapshots? A snapshot of N strokes × M points can
 * be megabytes per page; a command stack stores tiny `{do, undo}`
 * closures plus an id — orders of magnitude smaller. Actions must
 * be pure (no closure over external mutable state) and idempotent.
 *
 * Keyboard: a window-level keydown listener fires `undo()` on
 * Ctrl/Cmd+Z and `redo()` on Ctrl/Cmd+Y (or Ctrl/Cmd+Shift+Z). The
 * listener is a no-op when the user is typing in an <input> /
 * <textarea> / [contenteditable].
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_LIMIT = 200;

export function useUndoRedo({ limit = DEFAULT_LIMIT } = {}) {
  const [present, setPresent] = useState([]);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  // Bumped whenever a stack-mutating fn runs. The toolbar reads
  // canUndo / canRedo, so we need this to be reactive.
  const [version, setVersion] = useState(0);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  /**
   * Replace the present and clear both stacks. Use this when the
   * page number changes or a fresh server snapshot arrives.
   */
  const reset = useCallback((next) => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setPresent(Array.isArray(next) ? next : []);
    bump();
  }, [bump]);

  /**
   * Apply `action.do` to the present and push the action onto the
   * undo stack. Clears the redo stack.
   */
  const push = useCallback((action) => {
    if (!action || typeof action.do !== 'function' || typeof action.undo !== 'function') {
      return;
    }
    setPresent((curr) => {
      try {
        const next = action.do(curr);
        return Array.isArray(next) ? next : curr;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('useUndoRedo.do() threw:', err);
        return curr;
      }
    });
    undoStackRef.current.push(action);
    if (undoStackRef.current.length > limit) undoStackRef.current.shift();
    redoStackRef.current = [];
    bump();
  }, [bump, limit]);

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return false;
    const action = stack.pop();
    setPresent((curr) => {
      try {
        const next = action.undo(curr);
        return Array.isArray(next) ? next : curr;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('useUndoRedo.undo() threw:', err);
        return curr;
      }
    });
    redoStackRef.current.push(action);
    bump();
    return true;
  }, [bump]);

  const redo = useCallback(() => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return false;
    const action = stack.pop();
    setPresent((curr) => {
      try {
        const next = action.do(curr);
        return Array.isArray(next) ? next : curr;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('useUndoRedo.redo() threw:', err);
        return curr;
      }
    });
    undoStackRef.current.push(action);
    bump();
    return true;
  }, [bump]);

  const clearRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    redoStackRef.current = [];
    bump();
  }, [bump]);

  // Keyboard binding.
  useEffect(() => {
    const isEditable = (el) => {
      if (!el) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      return el.isContentEditable === true;
    };
    const onKey = (ev) => {
      if (ev.defaultPrevented) return;
      if (isEditable(ev.target)) return;
      const mod = ev.ctrlKey || ev.metaKey;
      if (!mod) return;
      const k = ev.key.toLowerCase();
      if (k === 'z' && !ev.shiftKey) {
        ev.preventDefault();
        undo();
      } else if ((k === 'z' && ev.shiftKey) || k === 'y') {
        ev.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return {
    present,
    setPresent,
    push,
    undo,
    redo,
    clearRedo,
    reset,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    sizes: {
      undo: undoStackRef.current.length,
      redo: redoStackRef.current.length
    },
    // Expose the underlying stack refs so consumers can "peek" the most
    // recently-pushed action when wiring async side effects (e.g. server
    // sync on undo/redo). Read-only in spirit, but the arrays are
    // deliberately not frozen so the hook can still mutate them.
    undoStackRef,
    redoStackRef,
    version
  };
}

export default useUndoRedo;
