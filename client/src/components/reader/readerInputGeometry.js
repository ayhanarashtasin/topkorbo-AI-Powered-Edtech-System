export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function distancePointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function orientation(ax, ay, bx, by, cx, cy) {
  return (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a.x, a.y, b.x, b.y, c.x, c.y);
  const o2 = orientation(a.x, a.y, b.x, b.y, d.x, d.y);
  const o3 = orientation(c.x, c.y, d.x, d.y, a.x, a.y);
  const o4 = orientation(c.x, c.y, d.x, d.y, b.x, b.y);
  if (!(o1 * o2 <= 0 && o3 * o4 <= 0)) return false;
  return Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <= Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x))
    && Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <= Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y));
}

function segmentDistance(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    distancePointToSegment(a.x, a.y, c.x, c.y, d.x, d.y),
    distancePointToSegment(b.x, b.y, c.x, c.y, d.x, d.y),
    distancePointToSegment(c.x, c.y, a.x, a.y, b.x, b.y),
    distancePointToSegment(d.x, d.y, a.x, a.y, b.x, b.y)
  );
}

function strokePointsPx(stroke, pageWidth, pageHeight) {
  return (stroke?.points || []).map((point) => ({
    x: point.x * pageWidth,
    y: point.y * pageHeight
  }));
}

export function strokeIntersectsPath(stroke, path, pageWidth, pageHeight, radiusPx) {
  const strokePoints = strokePointsPx(stroke, pageWidth, pageHeight);
  if (strokePoints.length === 0 || path.length === 0) return false;
  const widthScale = stroke.referenceWidth ? pageWidth / stroke.referenceWidth : 1;
  const strokeRadius = ((stroke.strokeWidth || 3) * widthScale) / 2;
  const tolerance = radiusPx + strokeRadius;

  if (strokePoints.length === 1 || path.length === 1) {
    return strokePoints.some((point) => path.some((cursor) => Math.hypot(point.x - cursor.x, point.y - cursor.y) <= tolerance));
  }
  for (let strokeIndex = 1; strokeIndex < strokePoints.length; strokeIndex += 1) {
    for (let pathIndex = 1; pathIndex < path.length; pathIndex += 1) {
      if (segmentDistance(
        strokePoints[strokeIndex - 1], strokePoints[strokeIndex],
        path[pathIndex - 1], path[pathIndex]
      ) <= tolerance) return true;
    }
  }
  return false;
}

export function eraseStrokeByPath(stroke, path, pageWidth, pageHeight, radiusPx) {
  const points = stroke?.points || [];
  if (points.length === 0 || path.length === 0) return null;
  const widthScale = stroke.referenceWidth ? pageWidth / stroke.referenceWidth : 1;
  const tolerance = radiusPx + ((stroke.strokeWidth || 3) * widthScale) / 2;
  const isErased = (point) => {
    const px = point.x * pageWidth;
    const py = point.y * pageHeight;
    if (path.length === 1) return Math.hypot(px - path[0].x, py - path[0].y) <= tolerance;
    for (let index = 1; index < path.length; index += 1) {
      if (distancePointToSegment(px, py, path[index - 1].x, path[index - 1].y, path[index].x, path[index].y) <= tolerance) {
        return true;
      }
    }
    return false;
  };

  const segments = [];
  let current = [];
  let changed = false;
  for (const point of points) {
    if (isErased(point)) {
      changed = true;
      if (current.length > 0) segments.push(current);
      current = [];
    } else {
      current.push(point);
    }
  }
  if (current.length > 0) segments.push(current);
  return changed ? segments : null;
}

function samplePath(path, spacing) {
  if (path.length < 2) return path;
  const samples = [path[0]];
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1];
    const to = path[index];
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      samples.push({ x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio });
    }
  }
  return samples;
}

export function eraseHighlightsByPath(highlights, path, pageWidth, pageHeight, radiusPx) {
  const changes = {};
  const samples = samplePath(path, Math.max(2, radiusPx / 2));
  for (const highlight of highlights || []) {
    let rects = Array.isArray(highlight.rects) ? highlight.rects : [];
    let changed = false;
    for (const cursor of samples) {
      const nextRects = [];
      for (const rect of rects) {
        const left = rect.x * pageWidth;
        const top = rect.y * pageHeight;
        const right = (rect.x + rect.width) * pageWidth;
        const bottom = (rect.y + rect.height) * pageHeight;
        const nearestX = clamp(cursor.x, left, right);
        const nearestY = clamp(cursor.y, top, bottom);
        if (Math.hypot(nearestX - cursor.x, nearestY - cursor.y) >= radiusPx) {
          nextRects.push(rect);
          continue;
        }
        changed = true;
        const cutLeft = clamp((cursor.x - radiusPx) / pageWidth, rect.x, rect.x + rect.width);
        const cutRight = clamp((cursor.x + radiusPx) / pageWidth, rect.x, rect.x + rect.width);
        const leftWidth = cutLeft - rect.x;
        const rightWidth = rect.x + rect.width - cutRight;
        if (leftWidth > 0.0005) nextRects.push({ ...rect, width: leftWidth });
        if (rightWidth > 0.0005) nextRects.push({ ...rect, x: cutRight, width: rightWidth });
      }
      rects = nextRects;
      if (rects.length === 0) break;
    }
    if (changed) changes[String(highlight._id)] = rects;
  }
  return changes;
}

export function highlightIntersectsPath(highlight, path, pageWidth, pageHeight, radiusPx) {
  return (highlight?.rects || []).some((rect) => path.some((cursor) => {
    const left = rect.x * pageWidth;
    const top = rect.y * pageHeight;
    const right = (rect.x + rect.width) * pageWidth;
    const bottom = (rect.y + rect.height) * pageHeight;
    return Math.hypot(clamp(cursor.x, left, right) - cursor.x, clamp(cursor.y, top, bottom) - cursor.y) <= radiusPx;
  }));
}
