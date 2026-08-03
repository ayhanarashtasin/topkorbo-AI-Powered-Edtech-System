import { useCallback, useEffect, useRef } from 'react';
import {
  getSampledPoints,
  drawActiveStroke,
  drawTaperedStroke,
  computeWidth,
  clamp
} from './usePenRenderer';

const PALM_REJECTION_MS = 60;

export function useDrawing({
  canvasRef,
  pageWidth,
  pageHeight,
  color,
  baseWidth,
  pressureSimEnabled,
  active,
  onCommit
}) {
  const strokeRef = useRef([]);
  const pxRef = useRef([]);
  const drawnIdxRef = useRef(0);
  const rafIdRef = useRef(0);
  const activePointerIdRef = useRef(null);
  const activeRectRef = useRef(null);
  const lastNonTouchRef = useRef({ ts: 0, type: 'mouse' });

  const clearActiveCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [canvasRef]);

  const toLocal = useCallback((event) => {
    const rect = activeRectRef.current || canvasRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return null;
    return {
      nx: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      ny: clamp((event.clientY - rect.top) / rect.height, 0, 1),
      pressure: typeof event.pressure === 'number' ? event.pressure : 0,
      t: event.timeStamp || performance.now(),
      rect
    };
  }, [canvasRef]);

  const redrawActiveStroke = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || pxRef.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTaperedStroke(ctx, pxRef.current, color);
    drawnIdxRef.current = pxRef.current.length;
  }, [canvasRef, color]);

  // Draw only newly received segments during pointer movement. The committed
  // high-quality ribbon is still rendered once on release, reducing an active
  // N-point stroke from O(N²) redraw work to O(N).
  const drawPendingSegments = useCallback(() => {
    const canvas = canvasRef.current;
    const points = pxRef.current;
    if (!canvas || points.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (drawnIdxRef.current === 0) {
      drawActiveStroke(ctx, [points[0]], color, points[0].w || baseWidth);
      drawnIdxRef.current = 1;
    }
    for (let index = Math.max(1, drawnIdxRef.current); index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      drawActiveStroke(ctx, [previous, current], color, ((previous.w || baseWidth) + (current.w || baseWidth)) / 2);
    }
    drawnIdxRef.current = points.length;
  }, [baseWidth, canvasRef, color]);

  const scheduleDraw = useCallback(() => {
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = 0;
      drawPendingSegments();
    });
  }, [drawPendingSegments]);

  const appendSamples = useCallback((reactEvent) => {
    const nativeEvent = reactEvent.nativeEvent || reactEvent;
    const coalesced = typeof nativeEvent.getCoalescedEvents === 'function'
      ? nativeEvent.getCoalescedEvents()
      : [];
    const events = coalesced.length > 0 ? coalesced : [nativeEvent];
    for (const event of events) {
      const local = toLocal(event);
      if (!local) continue;
      const previous = strokeRef.current[strokeRef.current.length - 1];
      if (previous && previous.x === local.nx && previous.y === local.ny) continue;
      const raw = { x: local.nx, y: local.ny, t: local.t, p: local.pressure };
      const dt = previous ? Math.max(1, raw.t - previous.t) : 1;
      const velocity = previous
        ? Math.hypot((raw.x - previous.x) * local.rect.width, (raw.y - previous.y) * local.rect.height) / dt
        : 0;
      const width = computeWidth(velocity / Math.max(local.rect.width, local.rect.height), baseWidth, raw.p, pressureSimEnabled);
      strokeRef.current.push(raw);
      pxRef.current.push({ x: raw.x * local.rect.width, y: raw.y * local.rect.height, w: width });
    }
  }, [baseWidth, pressureSimEnabled, toLocal]);

  const abandonStroke = useCallback((event) => {
    const pointerId = activePointerIdRef.current;
    if (pointerId === null || (event?.pointerId !== undefined && event.pointerId !== pointerId)) return;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }
    try { canvasRef.current?.releasePointerCapture(pointerId); } catch { /* already released */ }
    activePointerIdRef.current = null;
    activeRectRef.current = null;
    strokeRef.current = [];
    pxRef.current = [];
    drawnIdxRef.current = 0;
    clearActiveCanvas();
  }, [canvasRef, clearActiveCanvas]);

  const onPointerDown = useCallback((event) => {
    if (!active || event.isPrimary === false || activePointerIdRef.current !== null) return;
    if (event.button !== 0) return;

    if (event.pointerType === 'touch') {
      const last = lastNonTouchRef.current;
      if (last.type !== 'touch' && event.timeStamp - last.ts < PALM_REJECTION_MS) return;
    } else {
      lastNonTouchRef.current = { ts: event.timeStamp, type: event.pointerType };
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    activeRectRef.current = canvas.getBoundingClientRect();
    if (!activeRectRef.current.width || !activeRectRef.current.height) return;
    activePointerIdRef.current = event.pointerId;
    try { canvas.setPointerCapture(event.pointerId); } catch { /* unsupported browser */ }

    strokeRef.current = [];
    pxRef.current = [];
    drawnIdxRef.current = 0;
    clearActiveCanvas();
    appendSamples(event);
    drawPendingSegments();
    event.preventDefault();
  }, [active, appendSamples, canvasRef, clearActiveCanvas, drawPendingSegments]);

  const onPointerMove = useCallback((event) => {
    if (!active || event.pointerId !== activePointerIdRef.current) return;
    appendSamples(event);
    scheduleDraw();
    event.preventDefault();
  }, [active, appendSamples, scheduleDraw]);

  const finishStroke = useCallback((event) => {
    const pointerId = activePointerIdRef.current;
    if (!active || pointerId === null || event.pointerId !== pointerId) return;
    appendSamples(event);
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }
    redrawActiveStroke();
    const sampled = getSampledPoints(strokeRef.current);
    const referenceWidth = activeRectRef.current?.width || pageWidth;
    const referenceHeight = activeRectRef.current?.height || pageHeight;
    activePointerIdRef.current = null;
    try { canvasRef.current?.releasePointerCapture(pointerId); } catch { /* already released */ }
    activeRectRef.current = null;
    strokeRef.current = [];
    pxRef.current = [];
    drawnIdxRef.current = 0;

    if (sampled.length === 0) return;
    const points = sampled.map((sample, index) => {
      const previous = sampled[Math.max(0, index - 1)];
      const dt = Math.max(1, sample.t - previous.t);
      const velocity = Math.hypot(
        (sample.x - previous.x) * referenceWidth,
        (sample.y - previous.y) * referenceHeight
      ) / dt / Math.max(referenceWidth, referenceHeight);
      return {
        x: sample.x,
        y: sample.y,
        w: computeWidth(velocity, baseWidth, sample.p || 0, pressureSimEnabled),
        p: sample.p || 0
      };
    });
    onCommit?.({ color, baseWidth, referenceWidth, points, clientTs: Date.now() });
  }, [active, appendSamples, baseWidth, canvasRef, color, onCommit, pageHeight, pageWidth, pressureSimEnabled, redrawActiveStroke]);

  useEffect(() => () => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
  }, []);

  useEffect(() => {
    if (!active) abandonStroke();
  }, [abandonStroke, active]);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishStroke,
      onPointerCancel: abandonStroke,
      onLostPointerCapture: abandonStroke
    },
    forceRedraw: redrawActiveStroke
  };
}

export default useDrawing;
