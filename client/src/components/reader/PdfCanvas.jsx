import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
// Vite's `?url` import bundles a real worker URL into the build, which avoids
// both CDN CORS issues and react-pdf's broken default `workerSrc` (a relative
// path that doesn't resolve in production).
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useLanguage } from '../../hooks/useLanguage';
import AnnotationCanvas from './AnnotationCanvas';
import HighlightLayer from './HighlightLayer';
import HighlightPopup from './HighlightPopup';
import './PdfCanvas.css';

// Point pdfjs at the bundled worker; fall back to a version-matched CDN URL
// if the bundled asset failed to load for any reason.
try {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  // eslint-disable-next-line no-console
  console.info('[PdfCanvas] Worker URL set:', pdfWorkerUrl);
} catch (err) {
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    // eslint-disable-next-line no-console
    console.warn('[PdfCanvas] Worker fallback to CDN', err);
  } catch (err2) {
    // eslint-disable-next-line no-console
    console.error('pdfjs worker setup failed:', err2);
  }
}

/**
 * PdfCanvas renders a single PDF page plus all interactive overlays
 * (pen strokes, highlights, highlight popups). Responsibilities:
 *  - Loads the file once via <Document> and reports the page count.
 *  - Renders the current page with its text layer.
 *  - Receives committed pen strokes from AnnotationCanvas and surfaces
 *    them to the parent via `onAnnotate`.
 *  - Hit-tests pen strokes in eraser mode.
 *
 * All stroke points are stored in NORMALISED [0..1] space so they
 * survive resize/zoom; per-point width `w` is in CSS px.
 */
export default function PdfCanvas({
  fileUrl,
  pageNumber,
  scale,
  annotations,
  activeTool,
  penColor,
  penWidth,
  pressureSimEnabled,
  eraserType = 'stroke',
  eraserWidth = 16,
  highlights = [],
  onAnnotate,
  onAnnotationClick,
  onAnnotationPartialErase,
  onHighlightPartialEraseEnd,
  onAddHighlight,
  onDeleteHighlight,
  onDocumentLoad,
  onDocumentError,
  onPageTextReady
}) {
  const { t } = useLanguage();
  const pageRef = useRef(null);
  const annotationCanvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [loadError, setLoadError] = useState(null);
  const [selectionPopup, setSelectionPopup] = useState(null);
  const [activeNotePopup, setActiveNotePopup] = useState(null);

  // Mirror of highlights used during drag-erase so we can update at 60fps
// without spamming the backend; flushed on pointerUp via
// `onHighlightPartialEraseEnd`.
  const [localHighlights, setLocalHighlights] = useState(highlights);
  const modifiedHighlightsRef = useRef({});

  useEffect(() => {
    if (!isErasingRef.current) {
      setLocalHighlights(highlights);
    }
  }, [highlights]);

  // Pen strokes the AnnotationCanvas needs to render.
  const penAnnotations = useMemo(
    () => (annotations || []).filter((a) => a.type === 'pen'),
    [annotations]
  );

  // In eraser mode the AnnotationCanvas is `pointer-events: none` and the
// wrapper receives the events. The hit-test is rAF-throttled because
// `findPenStrokeAt` is O(N) — without throttling a fast pointermove on a
// page with 200 strokes can fire it 1000+ times/sec.
  const eraserRafRef = useRef(0);
  const pendingPointerRef = useRef(null);
  const isErasingRef = useRef(false);
  const lastErasePosRef = useRef(null);
  const isHighlightDraggingRef = useRef(false);
  const highlightStartNodeRef = useRef(null);
  const highlightStartOffsetRef = useRef(0);
  const highlightRafRef = useRef(0);
  const pendingHighlightPointerRef = useRef(null);

  // Global pointerup/pointerdown handlers — prevent sticky drag state when the
// pointer is released outside the wrapper, and dismiss stray popups when
// clicking elsewhere on the page.
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      isErasingRef.current = false;
      lastErasePosRef.current = null;
      isHighlightDraggingRef.current = false;
      highlightStartNodeRef.current = null;
    };
    const handleGlobalPointerDown = (e) => {
      if (!e.target.closest('.rb-highlight-popup')) {
        setSelectionPopup(null);
      }
      if (!e.target.closest('.rb-highlight-note-viewer') && !e.target.closest('.rb-highlight-note-icon')) {
        setActiveNotePopup(null);
      }
    };
    const handleSelectionChange = () => {
      if (activeTool === 'pen' || activeTool === 'eraser') return;
      // Note: don't auto-dismiss the selection popup on selectionchange —
      // focusing the note textarea collapses the selection and would
      // tear down the popup while the user is typing.
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointerdown', handleGlobalPointerDown);
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointerdown', handleGlobalPointerDown);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [activeTool]);

  const onWrapperPointerUp = useCallback(() => {
    isErasingRef.current = false;
    lastErasePosRef.current = null;
    isHighlightDraggingRef.current = false;
    highlightStartNodeRef.current = null;

    if (Object.keys(modifiedHighlightsRef.current).length > 0) {
      if (onHighlightPartialEraseEnd) {
        onHighlightPartialEraseEnd(modifiedHighlightsRef.current);
      }
      modifiedHighlightsRef.current = {};
    }

    if (activeTool === 'pen' || activeTool === 'eraser') return;
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const container = wrapperRef.current?.querySelector('.rb-pdf-page-container');
      if (!container) return;
      const containerRect = container.getBoundingClientRect();

      const rects = [];
      let boundingRect = null;
      let text = '';

      for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        text += range.toString();
        const domRects = range.getClientRects();
        for (let j = 0; j < domRects.length; j++) {
          const r = domRects[j];
          const normRect = {
            x: (r.left - containerRect.left) / containerRect.width,
            y: (r.top - containerRect.top) / containerRect.height,
            width: r.width / containerRect.width,
            height: r.height / containerRect.height
          };
          rects.push(normRect);

          if (!boundingRect) {
            boundingRect = { ...normRect };
          } else {
            const minX = Math.min(boundingRect.x, normRect.x);
            const minY = Math.min(boundingRect.y, normRect.y);
            const maxX = Math.max(boundingRect.x + boundingRect.width, normRect.x + normRect.width);
            const maxY = Math.max(boundingRect.y + boundingRect.height, normRect.y + normRect.height);
            boundingRect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
          }
        }
      }

      if (rects.length > 0 && text.trim()) {
        const lastDomRect = selection.getRangeAt(selection.rangeCount - 1).getBoundingClientRect();

        if (activeTool === 'highlighter') {
          // Apply highlight immediately without showing popup
          if (onAddHighlight) {
            onAddHighlight({
              pageNumber,
              text: text.trim(),
              color: penColor,
              note: '',
              boundingRect,
              rects
            });
          }
          window.getSelection()?.removeAllRanges();
        } else {
          // Fallback to popup if using 'select' tool
          setSelectionPopup({
            position: { x: lastDomRect.right + 'px', y: lastDomRect.top + 'px' },
            text: text.trim(),
            rects,
            boundingRect
          });
        }
      }
    }, 10);
  }, [activeTool, penColor, pageNumber, onAddHighlight]);

  const onWrapperPointerDown = useCallback(
    (ev) => {
      if (activeTool === 'highlighter' && (ev.pointerType === 'pen' || ev.pointerType === 'touch')) {
        ev.preventDefault();
        isHighlightDraggingRef.current = true;
        let range;
        if (document.caretRangeFromPoint) {
          range = document.caretRangeFromPoint(ev.clientX, ev.clientY);
        } else if (document.caretPositionFromPoint) {
          const pos = document.caretPositionFromPoint(ev.clientX, ev.clientY);
          if (pos) {
            range = document.createRange();
            range.setStart(pos.offsetNode, pos.offset);
            range.setEnd(pos.offsetNode, pos.offset);
          }
        }
        if (range) {
          highlightStartNodeRef.current = range.startContainer;
          highlightStartOffsetRef.current = range.startOffset;
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
        return;
      }

      if (activeTool !== 'eraser') return;
      ev.preventDefault();
      isErasingRef.current = true;

      const container = wrapperRef.current?.querySelector('.rb-pdf-page-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((ev.clientY - rect.top) / rect.height, 0, 1);

      lastErasePosRef.current = { x, y };

      if (eraserType === 'standard') {
        const er = (eraserWidth / 2) / rect.width;
        penAnnotations.forEach((stroke) => {
          const points = stroke.points || [];
          const hasInside = points.some((p) => Math.hypot(p.x - x, p.y - y) < er);
          if (hasInside) {
            const newSegments = [];
            let currentSeg = [];
            for (const p of points) {
              const dist = Math.hypot(p.x - x, p.y - y);
              if (dist >= er) {
                currentSeg.push(p);
              } else {
                if (currentSeg.length > 0) {
                  newSegments.push(currentSeg);
                  currentSeg = [];
                }
              }
            }
            if (currentSeg.length > 0) {
              newSegments.push(currentSeg);
            }
            if (onAnnotationPartialErase) {
              onAnnotationPartialErase(stroke, newSegments);
            }
          }
        });

        // Erase highlights
        setLocalHighlights((prevHls) => {
          let updated = [...prevHls];
          updated.forEach((hl, i) => {
            if (!hl.rects) return;
            let currentRects = hl.rects;
            let anyChanged = false;
            const res = [];
            for (const r of currentRects) {
              const px = clamp(x, r.x, r.x + r.width);
              const py = clamp(y, r.y, r.y + r.height);
              const distSq = (px - x) ** 2 + (py - y) ** 2;
              if (distSq < er * er) {
                anyChanged = true;
                const leftW = (x - er) - r.x;
                const rightStart = x + er;
                const rightW = (r.x + r.width) - rightStart;
                if (leftW > 0) res.push({ x: r.x, y: r.y, width: leftW, height: r.height });
                if (rightW > 0) res.push({ x: rightStart, y: r.y, width: rightW, height: r.height });
              } else {
                res.push(r);
              }
            }
            if (anyChanged) {
              updated[i] = { ...hl, rects: res };
              modifiedHighlightsRef.current[hl._id] = res;
            }
          });
          return updated;
        });

      } else {
        const hit = findPenStrokeAt(penAnnotations, x, y, 0.02);
        if (hit && onAnnotationClick) {
          onAnnotationClick(hit, ev);
        } else {
          const hitHl = findHighlightAt(localHighlights, x, y, 0.02);
          if (hitHl && onDeleteHighlight) {
            onDeleteHighlight(hitHl._id);
          }
        }
      }

    },
    [activeTool, penAnnotations, onAnnotationClick, eraserType, onAnnotationPartialErase, eraserWidth]
  );

  const onWrapperPointerCancel = useCallback(() => {
    isErasingRef.current = false;
    lastErasePosRef.current = null;
    isHighlightDraggingRef.current = false;
    highlightStartNodeRef.current = null;

    if (Object.keys(modifiedHighlightsRef.current).length > 0) {
      if (onHighlightPartialEraseEnd) {
        onHighlightPartialEraseEnd(modifiedHighlightsRef.current);
      }
      modifiedHighlightsRef.current = {};
    }
  }, [onHighlightPartialEraseEnd]);

  const onWrapperPointerMove = useCallback(
    (ev) => {
      if (activeTool === 'highlighter' && isHighlightDraggingRef.current && (ev.pointerType === 'pen' || ev.pointerType === 'touch')) {
        ev.preventDefault();
        pendingHighlightPointerRef.current = { x: ev.clientX, y: ev.clientY };
        
        if (highlightRafRef.current) return;
        highlightRafRef.current = requestAnimationFrame(() => {
          highlightRafRef.current = 0;
          const p = pendingHighlightPointerRef.current;
          if (!p) return;

          let range;
          if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(p.x, p.y);
          } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(p.x, p.y);
            if (pos) {
              range = document.createRange();
              range.setStart(pos.offsetNode, pos.offset);
              range.setEnd(pos.offsetNode, pos.offset);
            }
          }
          if (range && highlightStartNodeRef.current) {
            const sel = window.getSelection();
            if (sel) {
              const newRange = document.createRange();
              try {
                newRange.setStart(highlightStartNodeRef.current, highlightStartOffsetRef.current);
                newRange.setEnd(range.startContainer, range.startOffset);
              } catch (err) {
                try {
                  newRange.setStart(range.startContainer, range.startOffset);
                  newRange.setEnd(highlightStartNodeRef.current, highlightStartOffsetRef.current);
                } catch (e) {
                  // Ignore if direction fails
                }
              }
              sel.removeAllRanges();
              sel.addRange(newRange);
            }
          }
        });
        return;
      }

      if (activeTool !== 'eraser') return;
      ev.preventDefault();
      // Coalesce: store the latest event and schedule a single rAF
      // that performs the hit-test against the latest position.
      pendingPointerRef.current = { x: ev.clientX, y: ev.clientY };
      if (eraserRafRef.current) return;
      eraserRafRef.current = requestAnimationFrame(() => {
        eraserRafRef.current = 0;
        const p = pendingPointerRef.current;
        if (!p) return;
        const container = wrapperRef.current?.querySelector('.rb-pdf-page-container');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const x = clamp((p.x - rect.left) / rect.width, 0, 1);
        const y = clamp((p.y - rect.top) / rect.height, 0, 1);
        const hit = findPenStrokeAt(penAnnotations, x, y, 0.02);

        // Report coordinate change to setEraserHover so the custom circle follows the cursor
        if (annotationCanvasRef.current && annotationCanvasRef.current.setEraserHover) {
          annotationCanvasRef.current.setEraserHover({ x, y, stroke: hit });
        }

        // If drag-to-erase is active (pointer is down), erase intersected drawings
        if (isErasingRef.current) {
          if (eraserType === 'standard') {
            const er = (eraserWidth / 2) / rect.width;
            const lastPos = lastErasePosRef.current;
            penAnnotations.forEach((stroke) => {
              const points = stroke.points || [];
              const hasInside = points.some((p) => {
                if (lastPos) {
                  return pointToSegmentNorm(p.x, p.y, lastPos.x, lastPos.y, x, y) < er;
                }
                return Math.hypot(p.x - x, p.y - y) < er;
              });
              if (hasInside) {
                const newSegments = [];
                let currentSeg = [];
                for (const p of points) {
                  const dist = lastPos
                    ? pointToSegmentNorm(p.x, p.y, lastPos.x, lastPos.y, x, y)
                    : Math.hypot(p.x - x, p.y - y);
                  if (dist >= er) {
                    currentSeg.push(p);
                  } else {
                    if (currentSeg.length > 0) {
                      newSegments.push(currentSeg);
                      currentSeg = [];
                    }
                  }
                }
                if (currentSeg.length > 0) {
                  newSegments.push(currentSeg);
                }
                if (onAnnotationPartialErase) {
                  onAnnotationPartialErase(stroke, newSegments);
                }
              }
            });

            // Erase highlights
            setLocalHighlights((prevHls) => {
              let updated = [...prevHls];
              updated.forEach((hl, i) => {
                if (!hl.rects) return;
                let currentRects = hl.rects;
                let anyChanged = false;
                
                const steps = lastPos ? Math.max(1, Math.ceil(Math.hypot(x - lastPos.x, y - lastPos.y) / (er / 2))) : 1;
                for (let stepIdx = 1; stepIdx <= steps; stepIdx++) {
                  const t = stepIdx / steps;
                  const cx = lastPos ? lastPos.x + t * (x - lastPos.x) : x;
                  const cy = lastPos ? lastPos.y + t * (y - lastPos.y) : y;
                  
                  const res = [];
                  for (const r of currentRects) {
                    const px = clamp(cx, r.x, r.x + r.width);
                    const py = clamp(cy, r.y, r.y + r.height);
                    const distSq = (px - cx) ** 2 + (py - cy) ** 2;
                    if (distSq < er * er) {
                      anyChanged = true;
                      const leftW = (cx - er) - r.x;
                      const rightStart = cx + er;
                      const rightW = (r.x + r.width) - rightStart;
                      if (leftW > 0) res.push({ x: r.x, y: r.y, width: leftW, height: r.height });
                      if (rightW > 0) res.push({ x: rightStart, y: r.y, width: rightW, height: r.height });
                    } else {
                      res.push(r);
                    }
                  }
                  currentRects = res;
                }
                
                if (anyChanged) {
                  updated[i] = { ...hl, rects: currentRects };
                  modifiedHighlightsRef.current[hl._id] = currentRects;
                }
              });
              return updated;
            });

          } else {
            if (hit && onAnnotationClick) {
              onAnnotationClick(hit, ev);
            } else {
              const hitHl = findHighlightAt(localHighlights, x, y, 0.02);
              if (hitHl && onDeleteHighlight) {
                onDeleteHighlight(hitHl._id);
              }
            }
          }

          lastErasePosRef.current = { x, y };
        }
      });
    },
    [activeTool, penAnnotations, onAnnotationClick, eraserType, onAnnotationPartialErase, eraserWidth]
  );

  // Cancel any pending rAF callbacks when the component unmounts.
  useEffect(() => () => {
    if (eraserRafRef.current) cancelAnimationFrame(eraserRafRef.current);
    if (highlightRafRef.current) cancelAnimationFrame(highlightRafRef.current);
  }, []);

  const onWrapperPointerLeave = useCallback(() => {
    isErasingRef.current = false;
    lastErasePosRef.current = null;
    if (activeTool !== 'eraser') return;
    if (annotationCanvasRef.current && annotationCanvasRef.current.setEraserHover) {
      annotationCanvasRef.current.setEraserHover(null);
    }
  }, [activeTool]);

  const onWrapperClick = useCallback(
    (ev) => {
      if (activeTool !== 'eraser') return;
      const container = wrapperRef.current?.querySelector('.rb-pdf-page-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((ev.clientY - rect.top) / rect.height, 0, 1);
      const tol = 0.02;
      const hit = findPenStrokeAt(penAnnotations, x, y, tol);
      if (hit && onAnnotationClick) {
        onAnnotationClick(hit, ev);
      }
    },
    [activeTool, penAnnotations, onAnnotationClick]
  );

  // Memo key for the page-text extraction so zoom-driven re-fires of
// `onLoadSuccess` don't re-extract the same text.
  const extractedForKeyRef = useRef(null);

  const onPageLoadSuccess = useCallback(
    (page) => {
      const viewport = page.getViewport({ scale });
      setPageSize({ width: viewport.width, height: viewport.height });

      // Hand the page's text content up to the parent so the AI tutor can use
// it as context. Skipped on zoom because the text is identical for the
// same `(fileUrl, pageNumber)` pair.
      if (typeof onPageTextReady !== 'function') return;
      if (!page || typeof page.getTextContent !== 'function') return;

      const key = `${fileUrl}::${pageNumber}`;
      if (extractedForKeyRef.current === key) return;
      extractedForKeyRef.current = key;

      let cancelled = false;
      page
        .getTextContent()
        .then((tc) => {
          if (cancelled) return;
          const text = (tc?.items || [])
            .map((it) => (it && typeof it.str === 'string' ? it.str : ''))
            .filter(Boolean)
            .join(' ');
          onPageTextReady(text);
        })
        .catch((err) => {
          if (cancelled) return;
          // eslint-disable-next-line no-console
          console.warn('[PdfCanvas] getTextContent failed:', err?.message);
          onPageTextReady('');
        });
    },
    [scale, fileUrl, pageNumber, onPageTextReady]
  );

  // Allow re-extraction when the page or file actually changes.
  useEffect(() => {
    extractedForKeyRef.current = null;
  }, [fileUrl, pageNumber]);

  const handleDocumentError = useCallback((err) => {
    // eslint-disable-next-line no-console
    console.error('[PdfCanvas] Document load error', {
      fileUrl,
      message: err?.message,
      name: err?.name,
      stack: err?.stack
    });
    setLoadError(err);
    if (onDocumentError) onDocumentError(err);
  }, [fileUrl, onDocumentError]);

  // Wrapper class — drives cursor + overlay interactivity per active tool.
  const wrapperClass = useMemo(() => {
    const classes = ['rb-pdf-page-wrap'];
    if (activeTool === 'pen') classes.push('rb-pdf-page-wrap--pen');
    if (activeTool === 'eraser') classes.push('rb-pdf-page-wrap--eraser');
    if (activeTool === 'highlighter') classes.push('rb-pdf-page-wrap--highlighter');
    return classes.join(' ');
  }, [activeTool]);

  const handleCreateHighlight = async (color, note) => {
    if (!selectionPopup || !onAddHighlight) return;
    await onAddHighlight({
      pageNumber,
      text: selectionPopup.text,
      color,
      note,
      boundingRect: selectionPopup.boundingRect,
      rects: selectionPopup.rects
    });
    setSelectionPopup(null);
    window.getSelection()?.removeAllRanges();
  };



  // Forward committed pen strokes up to ReadingBookView's handleAnnotate.
  const handleStrokeCommit = useCallback((stroke) => {
    if (onAnnotate) {
      onAnnotate({
        type: 'pen',
        color: stroke.color,
        points: stroke.points,
        strokeWidth: stroke.baseWidth
      });
    }
  }, [onAnnotate]);

  return (
    <div
      className={wrapperClass}
      ref={wrapperRef}
      onClick={onWrapperClick}
      onPointerDown={onWrapperPointerDown}
      onPointerUp={onWrapperPointerUp}
      onPointerCancel={onWrapperPointerCancel}
      onPointerMove={onWrapperPointerMove}
      onPointerLeave={onWrapperPointerLeave}
    >
      <div className="rb-pdf-page-inner">
        <Document
          file={fileUrl}
          onLoadSuccess={(data) => {
            setLoadError(null);
            if (onDocumentLoad) onDocumentLoad(data);
          }}
          onLoadError={handleDocumentError}
          loading={
            <div className="rb-pdf-loading">
              <p>{t('rb.reader.loading')}</p>
            </div>
          }
          error={null}
        >
          <div className="rb-pdf-page-container">
            <Page
              ref={pageRef}
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              onLoadSuccess={onPageLoadSuccess}
              loading={
                <div className="rb-pdf-loading">
                  <p>{t('rb.reader.loading')}</p>
                </div>
              }
              error={
                <div className="rb-pdf-error">
                  <p>{t('rb.reader.pdf_error')}</p>
                </div>
              }
              className="rb-pdf-page"
            />
            {/* Pen overlay — owns pointer events, rAF rendering, and stroke smoothing. */}
            <AnnotationCanvas
              ref={annotationCanvasRef}
              pageWidth={pageSize.width}
              pageHeight={pageSize.height}
              strokes={penAnnotations}
              activeTool={activeTool}
              color={penColor}
              penWidth={penWidth}
              pressureSimEnabled={pressureSimEnabled}
              eraserWidth={eraserWidth}
              eraserType={eraserType}
              onStrokeCommit={handleStrokeCommit}
            />
            <HighlightLayer
              highlights={localHighlights}
              activeTool={activeTool}
              onHighlightClick={(h, e) => {
                if (activeTool === 'eraser') {
                  onDeleteHighlight && onDeleteHighlight(h._id);
                } else if ((activeTool === 'select' || activeTool === 'highlighter') && h.note) {
                  setActiveNotePopup({
                    note: h.note,
                    position: { x: e.clientX, y: e.clientY }
                  });
                }
              }}
            />
            {selectionPopup && (
              <HighlightPopup
                position={selectionPopup.position}
                onHighlight={handleCreateHighlight}
                onCancel={() => {
                  setSelectionPopup(null);
                  window.getSelection()?.removeAllRanges();
                }}
              />
            )}
          </div>
        </Document>
      </div>
      {activeNotePopup && (
        <div
          className="rb-highlight-note-viewer"
          style={{
            position: 'fixed',
            left: activeNotePopup.position.x + 10 + 'px',
            top: activeNotePopup.position.y + 10 + 'px',
            background: '#ffffff',
            padding: '12px 16px',
            borderRadius: '6px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            zIndex: 1000,
            maxWidth: '300px',
            border: '1px solid #eee',
            pointerEvents: 'auto'
          }}
        >
          <p style={{ margin: 0, fontSize: '14px', color: '#333', lineHeight: 1.4 }}>
            {activeNotePopup.note}
          </p>
        </div>
      )}
    </div>
  );
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// Distance from point (px,py) to line segment (ax,ay)→(bx,by), all in
// normalised [0..1] coordinates. Returns Infinity on degenerate segments.
function pointToSegmentNorm(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = px - ax;
    const ey = py - ay;
    return Math.sqrt(ex * ex + ey * ey);
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return Math.sqrt(ex * ex + ey * ey);
}

// Hit-test pen strokes at normalised (x,y). Returns the first stroke whose
// polyline comes within `tolerance` (widened by stroke width for easier hits).
function findPenStrokeAt(strokes, x, y, tolerance) {
  if (!Array.isArray(strokes)) return null;
  for (let s = 0; s < strokes.length; s += 1) {
    const stroke = strokes[s];
    const pts = stroke.points || [];
    if (pts.length < 1) continue;
    // Wider strokes get a proportionally wider hit-test so they're easier to target.
    const w = (stroke.strokeWidth || 3) / 1000;
    const tol = Math.max(tolerance, w * 4);
    if (pts.length === 1) {
      const dx = x - pts[0].x;
      const dy = y - pts[0].y;
      if (Math.sqrt(dx * dx + dy * dy) <= tol + 0.01) return stroke;
      continue;
    }
    for (let i = 1; i < pts.length; i += 1) {
      const d = pointToSegmentNorm(
        x, y,
        pts[i - 1].x, pts[i - 1].y,
        pts[i].x, pts[i].y
      );
      if (d <= tol) return stroke;
    }
  }
  return null;
}

// Find a highlight intersecting the given point
function findHighlightAt(highlights, x, y, tol) {
  if (!Array.isArray(highlights)) return null;
  for (const hl of highlights) {
    if (!hl.rects) continue;
    for (const r of hl.rects) {
      if (x >= r.x - tol && x <= r.x + r.width + tol &&
          y >= r.y - tol && y <= r.y + r.height + tol) {
        return hl;
      }
    }
  }
  return null;
}
