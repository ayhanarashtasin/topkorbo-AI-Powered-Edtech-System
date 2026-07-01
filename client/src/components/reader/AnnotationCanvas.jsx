/**
 * AnnotationCanvas
 *
 * Transparent canvas overlay that owns all pen-stroke rendering for a
 * single PDF page. It uses a 3-canvas stack so committed strokes never
 * flicker while an in-progress stroke is being redrawn every frame:
 *   - committedCanvas (bottom): completed strokes, repainted on change.
 *   - activeCanvas (middle): the in-progress stroke, repainted per frame.
 *   - overlayCanvas (top): transient guides like the eraser ring.
 *
 * Strokes store points in normalised [0,1] space; multiplied by
 * pageWidth/pageHeight to convert to CSS px before drawing.
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

  // Three stacked canvas refs (committed / active / overlay).
  const committedCanvasRef = useRef(null);
  const activeCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);

  // Cached state refs — avoids re-rendering the canvas layers when
// unrelated props change.
  const lastStrokesRef = useRef(strokes);
  const hoverRef = useRef(null);

  const dpr = window.devicePixelRatio || 1;
  const canvasWidth = Math.round(pageWidth * dpr);
  const canvasHeight = Math.round(pageHeight * dpr);

  /** Repaint every committed stroke into the committed canvas layer. */
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

  /** Draw the eraser hover ring (and any other transient guides) on the overlay. */
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

  // Repaint both layers whenever the strokes list changes.
  useEffect(() => {
    lastStrokesRef.current = strokes;
    repaintCommitLayer();
    repaintOverlay();
  }, [strokes, repaintCommitLayer, repaintOverlay]);

  // Repaint on window resize (handles zoom and DPR changes).
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

  // useDrawing renders the active stroke directly onto `activeCanvasRef`.
// On commit we clear that canvas and forward the stroke up to the parent,
// which triggers the `strokes` effect above to repaint the committed layer.
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

  // Expose an imperative API for the parent to push eraser-hover state
// without going through React props (avoids per-frame re-renders).
  useImperativeHandle(ref, () => ({
    setEraserHover(hit) {
      hoverRef.current = hit;
      repaintOverlay();
    }
  }), [repaintOverlay]);

  // CSS class — drives cursor + interaction behaviour per active tool.
  const className = useMemo(() => {
    const c = ['rb-annotation-canvas'];
    if (activeTool === 'pen') c.push('rb-annotation-canvas--pen');
    else if (activeTool === 'eraser') c.push('rb-annotation-canvas--eraser');
    else c.push('rb-annotation-canvas--select');
    return c.join(' ');
  }, [activeTool]);

  return (
    <>
      {/* Committed strokes live here so they aren't cleared while drawing. */}
      <canvas
        ref={committedCanvasRef}
        width={canvasWidth}
        height={canvasHeight}
        style={{ width: pageWidth, height: pageHeight }}
        className="rb-annotation-canvas rb-annotation-canvas--committed"
      />
      {/* Active canvas: owns pointer events and renders the in-progress stroke. */}
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
      {/* Overlay canvas: transient guides like the eraser ring (pointer-events: none). */}
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

// Render a single committed stroke using the tapered ribbon renderer
// for high-quality variable-width output.
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
