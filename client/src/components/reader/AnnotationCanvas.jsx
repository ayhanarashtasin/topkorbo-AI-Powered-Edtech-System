/**
 * AnnotationCanvas.jsx
 *
 * Transparent canvas overlay that owns all pen-stroke rendering for a
 * single PDF page.
 *
 * Architecture (3-canvas stack in DOM):
 *   1. committedCanvas — renders all committed/saved strokes. Only repaints
 *      when strokes, page dimensions, or zoom changes.
 *   2. activeCanvas — renders the in-progress stroke in real-time. Cleared
 *      and redrawn each frame during active drawing.
 *   3. overlayCanvas — renders transient visual guides (e.g. eraser ring).
 *
 * The visible stack has committedCanvas on the bottom (z-index 4), the active
 * canvas in the middle (z-index 5), and the overlay canvas on top (z-index 6).
 * During active drawing, only the active canvas is cleared and redrawn.
 * This guarantees completed strokes never flicker or disappear.
 *
 * Coordinate system: strokes store points in normalised [0, 1] space.
 * Multiplied by pageWidth / pageHeight to get CSS px before drawing.
 */

import { useEffect, useImperativeHandle, useMemo, useRef, forwardRef, useCallback } from 'react';
import { useDrawing } from '../../hooks/useDrawing';
import { drawTaperedStroke } from '../../hooks/usePenRenderer';
import './AnnotationCanvas.css';

const AnnotationCanvas = forwardRef(function AnnotationCanvas(props, ref) {
  const {
    pageWidth,
    pageHeight,
    strokes,
    activeTool,
    color,
    penWidth,
    pressureSimEnabled,
    eraserWidth = 16,
    eraserType = 'stroke',
    onStrokeCommit
  } = props;

  // --- Canvas refs ---
  const committedCanvasRef = useRef(null);
  const activeCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);

  // Cached state refs.
  const lastStrokesRef = useRef(strokes);
  const hoverRef = useRef(null);

  const dpr = window.devicePixelRatio || 1;
  const canvasWidth = Math.round(pageWidth * dpr);
  const canvasHeight = Math.round(pageHeight * dpr);

  /** Re-render all committed strokes into the committed canvas layer. */
  const repaintCommitLayer = useCallback(() => {
    const canvas = committedCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const currentDpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);

    if (Array.isArray(lastStrokesRef.current)) {
      for (let i = 0; i < lastStrokesRef.current.length; i += 1) {
        drawCommittedStroke(ctx, lastStrokesRef.current[i], pageWidth, pageHeight);
      }
    }
  }, [pageWidth, pageHeight]);

  /** Draw eraser ring or other transient visual guides on the overlay canvas. */
  const repaintOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const currentDpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);

    const hit = hoverRef.current;
    if (activeTool === 'eraser' && hit) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      const r = eraserType === 'standard' ? (eraserWidth / 2) : 8;
      ctx.arc(hit.x * pageWidth, hit.y * pageHeight, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [activeTool, pageWidth, pageHeight, eraserWidth, eraserType]);

  // Re-paint committed layer when strokes change.
  useEffect(() => {
    lastStrokesRef.current = strokes;
    repaintCommitLayer();
    repaintOverlay();
  }, [strokes, repaintCommitLayer, repaintOverlay]);

  // Re-paint on window resize (zoom, DPI changes).
  useEffect(() => {
    let rafId = 0;
    const onResize = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        repaintCommitLayer();
        repaintOverlay();
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [repaintCommitLayer, repaintOverlay]);

  // --- Drawing hook ---
  // useDrawing renders the active stroke directly onto activeCanvasRef.
  const drawing = useDrawing({
    canvasRef: activeCanvasRef,
    pageWidth,
    pageHeight,
    color,
    baseWidth: penWidth,
    pressureSimEnabled,
    active: activeTool === 'pen',
    onCommit: (stroke) => {
      // Clear the active canvas (stroke is now committed).
      const canvas = activeCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      // Forward to parent — this triggers the strokes useEffect above
      // which repaints the committed layer.
      if (onStrokeCommit) onStrokeCommit(stroke);
    }
  });

  // --- Imperative handle: eraser hover ---
  useImperativeHandle(ref, () => ({
    setEraserHover(hit) {
      hoverRef.current = hit;
      repaintOverlay();
    }
  }), [repaintOverlay]);

  // --- CSS class for tool ---
  const className = useMemo(() => {
    const c = ['rb-annotation-canvas'];
    if (activeTool === 'pen') c.push('rb-annotation-canvas--pen');
    else if (activeTool === 'eraser') c.push('rb-annotation-canvas--eraser');
    else c.push('rb-annotation-canvas--select');
    return c.join(' ');
  }, [activeTool]);

  return (
    <>
      {/* Committed canvas: completed strokes, layered underneath the active canvas. */}
      <canvas
        ref={committedCanvasRef}
        width={canvasWidth}
        height={canvasHeight}
        style={{ width: pageWidth, height: pageHeight }}
        className="rb-annotation-canvas rb-annotation-canvas--committed"
      />
      {/* Active canvas: receives pointer events, draws the in-progress stroke. */}
      <canvas
        ref={activeCanvasRef}
        width={canvasWidth}
        height={canvasHeight}
        style={{ width: pageWidth, height: pageHeight }}
        className={className}
        onPointerDown={drawing.handlers.onPointerDown}
        onPointerMove={drawing.handlers.onPointerMove}
        onPointerUp={drawing.handlers.onPointerUp}
        onPointerCancel={drawing.handlers.onPointerCancel}
      />
      {/* Overlay canvas: eraser hover ring, pointer-events: none. */}
      <canvas
        ref={overlayCanvasRef}
        width={canvasWidth}
        height={canvasHeight}
        style={{ width: pageWidth, height: pageHeight }}
        className="rb-annotation-canvas rb-annotation-canvas--overlay"
      />
    </>
  );
});

/* ---------- Helpers ---------- */

/**
 * Render a single committed stroke.
 * Uses the tapered ribbon renderer for high-quality variable-width output.
 */
function drawCommittedStroke(ctx, stroke, pageW, pageH) {
  if (!stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) return;
  const col = stroke.color || '#111827';
  const baseW = stroke.strokeWidth || 3;
  const px = new Array(stroke.points.length);
  for (let i = 0; i < stroke.points.length; i += 1) {
    const p = stroke.points[i];
    px[i] = {
      x: p.x * pageW,
      y: p.y * pageH,
      w: (typeof p.w === 'number' && p.w > 0) ? p.w : baseW
    };
  }
  drawTaperedStroke(ctx, px, col);
}

export default AnnotationCanvas;
