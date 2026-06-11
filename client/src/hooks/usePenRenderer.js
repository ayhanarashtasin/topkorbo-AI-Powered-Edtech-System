/**
 * usePenRenderer.js
 *
 * Pure drawing helpers for the pen annotation overlay. Stateless, no React,
 * no side effects. All functions are intentionally small and well-commented
 * so the math is auditable — this is the core "smooth pen" algorithm.
 *
 * Rendering architecture:
 *  - ACTIVE strokes (during drawing): rendered via drawActiveStroke() which
 *    uses Catmull-Rom splines converted to quadratic Bezier curves for smooth,
 *    natural-looking handwriting at O(N) cost with no per-frame rebuilds of
 *    tapered geometry.
 *  - COMMITTED strokes (after pointerup): rendered via drawTaperedStroke() which
 *    draws a variable-width ribbon. This is the high-quality final render.
 *
 * Coordinates: every point in the system is in NORMALISED [0, 1] space
 * relative to the page's CSS box. Callers multiply by `pageWidth` /
 * `pageHeight` (in CSS px) before drawing.
 */

import { useCallback, useMemo } from 'react';

/* ---------- Tunable constants ---------- */

/** Minimum distance (in normalised units) between two accepted samples. */
const MIN_SAMPLE_DIST = 0.0015;

/** Velocity at which the simulated pressure bottoms out. */
const VELOCITY_GAIN = 6;

/** Pressure bounds for width modulation. */
const WIDTH_MIN = 0.45;
const WIDTH_MAX = 1.55;

/* ---------- Pure helpers ---------- */

export function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

/**
 * Compute the width (in CSS px) of a pen segment given its velocity, the
 * tool's base width, and a flag indicating whether to use pressure
 * simulation.
 */
export function computeWidth(velocity, baseWidth, pressure, pressureSimEnabled) {
  let p;
  if (pressure > 0) {
    p = clamp(pressure, 0, 1);
  } else if (pressureSimEnabled) {
    p = clamp(1.5 - velocity * VELOCITY_GAIN, 0.4, 1.0);
  } else {
    p = 1.0;
  }
  return baseWidth * (WIDTH_MIN + (WIDTH_MAX - WIDTH_MIN) * p);
}

/**
 * Filter raw pointer samples to a minimum-distance grid. Returns a new
 * array; the first sample is always included.
 */
export function getSampledPoints(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out = [raw[0]];
  for (let i = 1; i < raw.length; i += 1) {
    const prev = out[out.length - 1];
    const cur = raw[i];
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    if (dx * dx + dy * dy >= MIN_SAMPLE_DIST * MIN_SAMPLE_DIST) {
      out.push(cur);
    }
  }
  return out;
}

/**
 * Prepare a 2D canvas for DPR-aware drawing. Sets the bitmap size to
 * `CSS-rect x devicePixelRatio`, resets the transform, and clears.
 *
 * @param {HTMLCanvasElement|null} canvas
 * @returns {{ctx: CanvasRenderingContext2D, rect: DOMRect, dpr: number} | null}
 */
export function prepCanvas(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, rect, dpr };
}

/* ---------- Active stroke rendering (smooth Catmull-Rom) ---------- */

/**
 * Draw a smooth, uniform-width stroke using Catmull-Rom splines converted
 * to quadratic Bezier curves. This is the fast, interactive renderer used
 * during active drawing (while the pointer is down). The result is smooth,
 * natural-looking handwriting with round line caps.
 *
 * @param {CanvasRenderingContext2D} ctx — already DPR-transformed
 * @param {Array<{x:number,y:number,w?:number}>} points — in CSS px
 * @param {string} color
 * @param {number} lineWidth — uniform stroke width in CSS px
 */
export function drawActiveStroke(ctx, points, color, lineWidth) {
  if (!points || points.length === 0) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth || 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, Math.max(1, lineWidth / 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
  } else {
    // Catmull-Rom to quadratic Bezier conversion.
    // For each segment i → i+1, we compute a control point that creates
    // a smooth curve through (or near) all input points. This produces
    // natural-looking handwriting without the angular artifacts of
    // straight lineTo segments.
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      // Catmull-Rom to Bezier control point: the control point is at
      // 1/3 the distance from each endpoint toward the tangent direction.
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  }

  ctx.stroke();
  ctx.restore();
}

/* ---------- Committed stroke rendering (tapered ribbon) ---------- */

/**
 * Render a single committed stroke as a filled, variable-width ribbon
 * that respects the per-point `w` (and pressure-derived width).
 *
 * Implementation: for each consecutive pair of input points we emit a
 * quad (two triangles) whose width is interpolated from the endpoints.
 * Quads are joined by the `lineJoin: 'round'` semantics on the fill,
 * which keeps the join visually smooth without explicit mitering.
 *
 * @param {CanvasRenderingContext2D} ctx — already DPR-transformed
 * @param {Array<{x:number,y:number,w?:number,p?:number}>} points — in CSS px
 * @param {string} color
 */
export function drawTaperedStroke(ctx, points, color) {
  if (!points || points.length === 0) return;
  if (points.length === 1) {
    const r = (points[0].w || 4) / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, Math.max(1, r), 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.fillStyle = color;
  ctx.beginPath();

  const top = [];
  const bottom = [];
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    const tlen = Math.hypot(tx, ty) || 1;
    tx /= tlen; ty /= tlen;
    const nx = -ty;
    const ny = tx;
    const halfW = (p.w || 4) / 2;
    top.push({ x: p.x + nx * halfW, y: p.y + ny * halfW });
    bottom.push({ x: p.x - nx * halfW, y: p.y - ny * halfW });
  }

  ctx.moveTo(top[0].x, top[0].y);
  for (let i = 1; i < top.length; i += 1) {
    ctx.lineTo(top[i].x, top[i].y);
  }
  for (let i = bottom.length - 1; i >= 0; i -= 1) {
    ctx.lineTo(bottom[i].x, bottom[i].y);
  }
  ctx.closePath();
  ctx.fill();
}

/* ---------- React hook wrapper ---------- */

export function usePenRenderer({ baseWidth, pressureSimEnabled } = {}) {
  const bw = baseWidth || 3;
  const sim = pressureSimEnabled !== false;

  const widthFor = useCallback(
    (velocity, pressure) => computeWidth(velocity, bw, pressure, sim),
    [bw, sim]
  );

  const helpers = useMemo(
    () => ({
      drawTaperedStroke,
      drawActiveStroke,
      computeWidth,
      clamp,
      prepCanvas
    }),
    []
  );

  return { widthFor, ...helpers, baseWidth: bw, pressureSimEnabled: sim };
}

export default usePenRenderer;
