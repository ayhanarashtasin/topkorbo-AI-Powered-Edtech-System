/**
 * useDrawing.js
 *
 * Owns the pen drawing lifecycle for a single canvas overlay.
 *
 * Responsibilities:
 *  1. Capture pointer events (mouse / pen / touch via Pointer Events).
 *  2. Normalise event coords to [0, 1] relative to the canvas's CSS box.
 *  3. Buffer raw samples (x, y, t, p) into a ref (NOT state — no re-render).
 *  4. Cache the canvas bounding client rect at pointerdown to eliminate layout thrashing.
 *  5. Coalesce redraws into a single requestAnimationFrame callback so a
 *     fast-moving pointer never produces more than one render per frame.
 *  6. Render the entire active stroke from scratch on activeCanvas on each frame,
 *     which avoids tangent/boundary alignment glitches.
 *  7. On pointerup, call `onCommit(stroke)` with the final stroke.
 *  8. Palm rejection: ignore secondary pointers (multi-touch) and any
 *     non-primary touch pointer that arrives within 60 ms of a
 *     non-touch pointer.
 *
 * Rendering approach:
 *  - Active strokes use drawTaperedStroke() which renders a high-quality tapered
 *    ribbon. During drawing, only the active canvas is cleared and redrawn;
 *    completed strokes on the committed canvas layer underneath are untouched.
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  getSampledPoints,
  drawTaperedStroke,
  computeWidth,
  clamp
} from './usePenRenderer';

const PALM_REJECTION_MS = 60;

/**
 * @param {object} options
 * @param {React.RefObject<HTMLCanvasElement>} options.canvasRef
 * @param {number} options.pageWidth   — current canvas width in CSS px
 * @param {number} options.pageHeight  — current canvas height in CSS px
 * @param {string} options.color       — current pen color
 * @param {number} options.baseWidth   — current pen base width (px)
 * @param {boolean} options.pressureSimEnabled
 * @param {boolean} options.active     — when false, the hook ignores all events
 * @param {(stroke: object) => void} options.onCommit
 */
export function useDrawing(options) {
  const {
    canvasRef,
    pageWidth,
    pageHeight,
    color,
    baseWidth,
    pressureSimEnabled,
    active,
    onCommit
  } = options;

  const strokeRef = useRef([]);
  const pxRef = useRef([]);
  const drawnIdxRef = useRef(0);
  const rafIdRef = useRef(0);
  const lastNonTouchRef = useRef({ ts: 0, type: 'mouse' });
  const activeRectRef = useRef(null);

  /* ---------- Pointer event handlers ---------- */

  const toLocal = useCallback(
    (ev) => {
      const rect = activeRectRef.current || (canvasRef.current ? canvasRef.current.getBoundingClientRect() : null);
      if (!rect || !rect.width || !rect.height) return null;
      return {
        nx: clamp((ev.clientX - rect.left) / rect.width, 0, 1),
        ny: clamp((ev.clientY - rect.top) / rect.height, 0, 1),
        pressure: typeof ev.pressure === 'number' ? ev.pressure : 0,
        t: ev.timeStamp || performance.now(),
        pointerType: ev.pointerType
      };
    },
    [canvasRef]
  );

  /**
   * Re-render the ENTIRE in-progress stroke. Called on every frame (via requestAnimationFrame)
   * while drawing, or when the page is resized/zoomed.
   * Clears the active canvas and draws the stroke from start to finish.
   */
  const redrawActiveStroke = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const px = pxRef.current;
    if (px.length === 0) return;

    const ctx = canvas.getContext('2d');
    const currentDpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);

    drawTaperedStroke(ctx, px, color);
    drawnIdxRef.current = px.length;
  }, [canvasRef, color]);

  const scheduleRedraw = useCallback(() => {
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = 0;
      redrawActiveStroke();
    });
  }, [redrawActiveStroke]);

  const onPointerDown = useCallback(
    (ev) => {
      if (!active) return;
      if (!ev.isPrimary) return;

      if (ev.pointerType === 'touch') {
        const last = lastNonTouchRef.current;
        if (last.type !== 'touch' && ev.timeStamp - last.ts < PALM_REJECTION_MS) {
          return;
        }
      } else {
        lastNonTouchRef.current = { ts: ev.timeStamp, type: ev.pointerType };
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Cache the bounding client rect at pointerdown to avoid layout thrashing during moves.
      activeRectRef.current = canvas.getBoundingClientRect();

      const local = toLocal(ev);
      if (!local) return;

      try {
        if (canvas && ev.pointerId !== undefined) {
          canvas.setPointerCapture(ev.pointerId);
        }
      } catch (_) {}

      strokeRef.current = [
        { x: local.nx, y: local.ny, t: local.t, p: local.pressure }
      ];
      const initialW = computeWidth(0, baseWidth, local.pressure, pressureSimEnabled);
      const r = activeRectRef.current;
      pxRef.current = [
        { x: local.nx * r.width, y: local.ny * r.height, w: initialW }
      ];
      drawnIdxRef.current = 0;

      // Clear the active canvas and draw the first dot immediately for instant feedback.
      const ctx = canvas.getContext('2d');
      const currentDpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
      
      drawTaperedStroke(ctx, pxRef.current, color);
      drawnIdxRef.current = 1;

      ev.preventDefault?.();
    },
    [active, canvasRef, toLocal, baseWidth, pressureSimEnabled, color]
  );

  const onPointerMove = useCallback(
    (ev) => {
      if (!active) return;
      if (!ev.isPrimary) return;
      if (strokeRef.current.length === 0) return;

      const local = toLocal(ev);
      if (!local) return;

      const newRaw = { x: local.nx, y: local.ny, t: local.t, p: local.pressure };
      strokeRef.current.push(newRaw);

      const prev = strokeRef.current[strokeRef.current.length - 2];
      const dt = Math.max(1, newRaw.t - prev.t);
      const v = Math.hypot(newRaw.x - prev.x, newRaw.y - prev.y) / dt;
      const w = computeWidth(v, baseWidth, newRaw.p, pressureSimEnabled);
      const r = activeRectRef.current || (canvasRef.current ? canvasRef.current.getBoundingClientRect() : { width: pageWidth, height: pageHeight });
      pxRef.current.push({ x: newRaw.x * r.width, y: newRaw.y * r.height, w });

      scheduleRedraw();
    },
    [active, baseWidth, canvasRef, pageWidth, pageHeight, pressureSimEnabled, scheduleRedraw, toLocal]
  );

  const finishStroke = useCallback(
    (ev) => {
      if (!active) return;
      if (strokeRef.current.length === 0) return;

      const canvas = canvasRef.current;
      try {
        if (canvas && ev && ev.pointerId !== undefined) {
          canvas.releasePointerCapture(ev.pointerId);
        }
      } catch (_) {}

      // Final full render for pixel-perfect smoothing.
      redrawActiveStroke();

      const sampled = getSampledPoints(strokeRef.current);
      strokeRef.current = [];
      pxRef.current = [];
      activeRectRef.current = null; // Clear cached rect

      if (sampled.length === 0) return;

      const rect = canvas ? canvas.getBoundingClientRect() : { width: pageWidth, height: pageHeight };
      const finalPoints = sampled.map((s, i) => {
        const prev = sampled[Math.max(0, i - 1)];
        const dt = Math.max(1, s.t - prev.t);
        const dx = s.x - prev.x;
        const dy = s.y - prev.y;
        const v = Math.hypot(dx, dy) / dt;
        const w = computeWidth(v, baseWidth, s.p || 0, pressureSimEnabled);
        return {
          x: s.x,
          y: s.y,
          w,
          p: s.p || 0
        };
      });

      if (onCommit) {
        onCommit({
          color,
          baseWidth,
          points: finalPoints,
          clientTs: Date.now()
        });
      }
    },
    [active, canvasRef, baseWidth, color, onCommit, pageWidth, pageHeight, pressureSimEnabled, redrawActiveStroke]
  );

  // Cleanup: cancel any pending rAF on unmount or when `active` flips off.
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
    };
  }, []);

  // If the user changes tool mid-stroke, abandon the current stroke.
  useEffect(() => {
    if (!active) {
      strokeRef.current = [];
      pxRef.current = [];
      drawnIdxRef.current = 0;
      activeRectRef.current = null;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
    }
  }, [active]);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishStroke,
      onPointerCancel: finishStroke
    },
    forceRedraw: redrawActiveStroke
  };
}

export default useDrawing;
