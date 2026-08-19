import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useLanguage } from '../../hooks/useLanguage';
import AnnotationCanvas from './AnnotationCanvas';
import HighlightLayer from './HighlightLayer';
import HighlightPopup from './HighlightPopup';
import {
  clamp,
  eraseHighlightsByPath,
  eraseStrokeByPath,
  highlightIntersectsPath,
  strokeIntersectsPath
} from './readerInputGeometry';
import './PdfCanvas.css';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function caretFromPoint(x, y) {
  if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
  const position = document.caretPositionFromPoint?.(x, y);
  if (!position) return null;
  const range = document.createRange();
  range.setStart(position.offsetNode, position.offset);
  range.collapse(true);
  return range;
}

function setSelectionBetween(anchorNode, anchorOffset, focusNode, focusOffset) {
  const selection = window.getSelection();
  if (!selection || !anchorNode || !focusNode) return false;
  try {
    if (typeof selection.setBaseAndExtent === 'function') {
      selection.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
      return true;
    }
    const anchor = document.createRange();
    const focus = document.createRange();
    anchor.setStart(anchorNode, anchorOffset);
    anchor.collapse(true);
    focus.setStart(focusNode, focusOffset);
    focus.collapse(true);
    const anchorFirst = anchor.compareBoundaryPoints(Range.START_TO_START, focus) <= 0;
    const range = document.createRange();
    range.setStart(anchorFirst ? anchorNode : focusNode, anchorFirst ? anchorOffset : focusOffset);
    range.setEnd(anchorFirst ? focusNode : anchorNode, anchorFirst ? focusOffset : anchorOffset);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  } catch {
    return false;
  }
}

export default function PdfCanvas({
  fileUrl,
  fileHeaders,
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
  onAnnotationEraseBatch,
  onAnnotationPartialErase,
  onAnnotationPartialEraseBatch,
  onHighlightPartialEraseEnd,
  onAddHighlight,
  onDeleteHighlight,
  onDocumentLoad,
  onDocumentError,
  onPageTextReady,
  onSummarizeSelection,
  canAnnotate = true
}) {
  const { t } = useLanguage();
  const wrapperRef = useRef(null);
  const annotationCanvasRef = useRef(null);
  const activePointerRef = useRef(null);
  const highlighterAnchorRef = useRef(null);
  const pendingHighlightPointRef = useRef(null);
  const highlightRafRef = useRef(0);
  const eraserRafRef = useRef(0);
  const finalizePointerRef = useRef(null);
  const extractedForKeyRef = useRef(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [selectionPopup, setSelectionPopup] = useState(null);
  const [activeNotePopup, setActiveNotePopup] = useState(null);
  const [localHighlights, setLocalHighlights] = useState(highlights);

  const documentFile = useMemo(
    () => fileHeaders ? { url: fileUrl, httpHeaders: fileHeaders } : fileUrl,
    [fileHeaders, fileUrl]
  );
  const penAnnotations = useMemo(
    () => (annotations || []).filter((annotation) => annotation.type === 'pen'),
    [annotations]
  );

  useEffect(() => {
    if (activePointerRef.current?.mode !== 'eraser') setLocalHighlights(highlights);
  }, [highlights]);

  const pageMetrics = useCallback(() => {
    const element = wrapperRef.current?.querySelector('.rb-pdf-page-container');
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return { element, rect };
  }, []);

  const pagePoint = useCallback((event) => {
    const metrics = pageMetrics();
    if (!metrics) return null;
    return {
      x: clamp(event.clientX - metrics.rect.left, 0, metrics.rect.width),
      y: clamp(event.clientY - metrics.rect.top, 0, metrics.rect.height),
      nx: clamp((event.clientX - metrics.rect.left) / metrics.rect.width, 0, 1),
      ny: clamp((event.clientY - metrics.rect.top) / metrics.rect.height, 0, 1),
      ...metrics
    };
  }, [pageMetrics]);

  const appendEraserSamples = useCallback((event) => {
    const active = activePointerRef.current;
    if (!active || active.mode !== 'eraser') return;
    const nativeEvent = event.nativeEvent || event;
    const coalesced = nativeEvent.getCoalescedEvents?.() || [];
    const events = coalesced.length > 0 ? coalesced : [nativeEvent];
    for (const sample of events) {
      const point = pagePoint(sample);
      if (!point) continue;
      const previous = active.path[active.path.length - 1];
      if (!previous || previous.x !== point.x || previous.y !== point.y) {
        active.path.push({ x: point.x, y: point.y, nx: point.nx, ny: point.ny });
      }
    }
  }, [pagePoint]);

  const updateEraserHover = useCallback((event) => {
    const point = pagePoint(event);
    if (!point) return;
    if (eraserRafRef.current) cancelAnimationFrame(eraserRafRef.current);
    eraserRafRef.current = requestAnimationFrame(() => {
      eraserRafRef.current = 0;
      const hit = penAnnotations.find((stroke) => strokeIntersectsPath(
        stroke,
        [{ x: point.x, y: point.y }],
        point.rect.width,
        point.rect.height,
        eraserType === 'standard' ? eraserWidth / 2 : 8
      ));
      annotationCanvasRef.current?.setEraserHover({ x: point.nx, y: point.ny, stroke: hit });
    });
  }, [eraserType, eraserWidth, pagePoint, penAnnotations]);

  const applyHighlighterPoint = useCallback((clientX, clientY) => {
    const anchor = highlighterAnchorRef.current;
    if (!anchor) return false;
    const focus = caretFromPoint(clientX, clientY);
    if (!focus) return false;
    const container = pageMetrics()?.element;
    if (!container || !container.contains(focus.startContainer)) return false;
    return setSelectionBetween(anchor.node, anchor.offset, focus.startContainer, focus.startOffset);
  }, [pageMetrics]);

  const collectSelection = useCallback(() => {
    const selection = window.getSelection();
    const metrics = pageMetrics();
    if (!selection || selection.isCollapsed || !metrics) return null;
    const rects = [];
    let text = '';
    let lastRect = null;
    for (let rangeIndex = 0; rangeIndex < selection.rangeCount; rangeIndex += 1) {
      const range = selection.getRangeAt(rangeIndex);
      text += range.toString();
      for (const domRect of range.getClientRects()) {
        const left = clamp(domRect.left - metrics.rect.left, 0, metrics.rect.width);
        const top = clamp(domRect.top - metrics.rect.top, 0, metrics.rect.height);
        const right = clamp(domRect.right - metrics.rect.left, 0, metrics.rect.width);
        const bottom = clamp(domRect.bottom - metrics.rect.top, 0, metrics.rect.height);
        if (right <= left || bottom <= top) continue;
        rects.push({
          x: left / metrics.rect.width,
          y: top / metrics.rect.height,
          width: (right - left) / metrics.rect.width,
          height: (bottom - top) / metrics.rect.height
        });
        lastRect = domRect;
      }
    }
    if (!text.trim() || rects.length === 0 || !lastRect) return null;
    const left = Math.min(...rects.map((rect) => rect.x));
    const top = Math.min(...rects.map((rect) => rect.y));
    const right = Math.max(...rects.map((rect) => rect.x + rect.width));
    const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
    return {
      text: text.trim(),
      rects,
      boundingRect: { x: left, y: top, width: right - left, height: bottom - top },
      position: {
        x: `${clamp(lastRect.right, 24, window.innerWidth - 24)}px`,
        y: `${clamp(lastRect.top, 70, window.innerHeight - 24)}px`
      }
    };
  }, [pageMetrics]);

  const finishSelection = useCallback(() => {
    const captured = collectSelection();
    if (!captured) return;
    if (activeTool === 'highlighter') {
      onAddHighlight?.({
        pageNumber,
        text: captured.text,
        color: penColor,
        note: '',
        boundingRect: captured.boundingRect,
        rects: captured.rects
      });
      window.getSelection()?.removeAllRanges();
    } else if (activeTool === 'select' && canAnnotate) {
      setSelectionPopup(captured);
    }
  }, [activeTool, canAnnotate, collectSelection, onAddHighlight, pageNumber, penColor]);

  const applyEraser = useCallback((active) => {
    const metrics = pageMetrics();
    if (!metrics || active.path.length === 0) return;
    const radius = eraserType === 'standard' ? eraserWidth / 2 : 8;
    if (eraserType === 'stroke') {
      const strokes = penAnnotations.filter((stroke) => strokeIntersectsPath(
        stroke, active.path, metrics.rect.width, metrics.rect.height, radius
      ));
      if (strokes.length > 0) {
        if (onAnnotationEraseBatch) onAnnotationEraseBatch(strokes);
        else strokes.forEach((stroke) => onAnnotationClick?.(stroke));
      }
      const highlightIds = localHighlights
        .filter((highlight) => highlightIntersectsPath(
          highlight, active.path, metrics.rect.width, metrics.rect.height, radius
        ))
        .map((highlight) => highlight._id);
      highlightIds.forEach((id) => onDeleteHighlight?.(id));
      if (highlightIds.length > 0) {
        const removed = new Set(highlightIds.map(String));
        setLocalHighlights((current) => current.filter((highlight) => !removed.has(String(highlight._id))));
      }
      return;
    }

    const modifications = [];
    for (const stroke of penAnnotations) {
      const newSegments = eraseStrokeByPath(
        stroke, active.path, metrics.rect.width, metrics.rect.height, radius
      );
      if (newSegments) modifications.push({ originalStroke: stroke, newSegments });
    }
    if (modifications.length > 0) {
      if (onAnnotationPartialEraseBatch) onAnnotationPartialEraseBatch(modifications);
      else modifications.forEach(({ originalStroke, newSegments }) => onAnnotationPartialErase?.(originalStroke, newSegments));
    }

    const highlightChanges = eraseHighlightsByPath(
      localHighlights, active.path, metrics.rect.width, metrics.rect.height, radius
    );
    if (Object.keys(highlightChanges).length > 0) {
      setLocalHighlights((current) => current
        .map((highlight) => highlightChanges[String(highlight._id)] === undefined
          ? highlight
          : { ...highlight, rects: highlightChanges[String(highlight._id)] })
        .filter((highlight) => highlight.rects.length > 0));
      onHighlightPartialEraseEnd?.(highlightChanges);
    }
  }, [eraserType, eraserWidth, localHighlights, onAnnotationClick, onAnnotationEraseBatch, onAnnotationPartialErase, onAnnotationPartialEraseBatch, onDeleteHighlight, onHighlightPartialEraseEnd, pageMetrics, penAnnotations]);

  const releasePointer = useCallback((pointerId) => {
    try { wrapperRef.current?.releasePointerCapture(pointerId); } catch { /* already released */ }
  }, []);

  const finalizePointer = useCallback((event) => {
    const active = activePointerRef.current;
    if (!active || (event.pointerId !== undefined && event.pointerId !== active.pointerId)) return;
    if (active.mode === 'eraser') {
      appendEraserSamples(event);
      applyEraser(active);
    } else if (active.mode === 'highlighter') {
      if (highlightRafRef.current) {
        cancelAnimationFrame(highlightRafRef.current);
        highlightRafRef.current = 0;
      }
      const finalPoint = pendingHighlightPointRef.current || { x: event.clientX, y: event.clientY };
      applyHighlighterPoint(finalPoint.x, finalPoint.y);
      finishSelection();
    } else if (active.mode === 'native-highlighter' || active.mode === 'native-select') {
      requestAnimationFrame(finishSelection);
    }
    activePointerRef.current = null;
    highlighterAnchorRef.current = null;
    pendingHighlightPointRef.current = null;
    releasePointer(active.pointerId);
  }, [appendEraserSamples, applyEraser, applyHighlighterPoint, finishSelection, releasePointer]);

  useEffect(() => { finalizePointerRef.current = finalizePointer; }, [finalizePointer]);

  useEffect(() => {
    const onGlobalPointerUp = (event) => finalizePointerRef.current?.(event);
    const dismissPopups = (event) => {
      if (!event.target.closest?.('.rb-highlight-popup')) setSelectionPopup(null);
      if (!event.target.closest?.('.rb-highlight-note-viewer, .rb-highlight-note-icon')) setActiveNotePopup(null);
    };
    window.addEventListener('pointerup', onGlobalPointerUp);
    window.addEventListener('pointerdown', dismissPopups);
    return () => {
      window.removeEventListener('pointerup', onGlobalPointerUp);
      window.removeEventListener('pointerdown', dismissPopups);
    };
  }, []);

  const onWrapperPointerDown = useCallback((event) => {
    if (event.isPrimary === false || activePointerRef.current) return;
    if (event.button !== 0) return;
    if (activeTool === 'highlighter' && (event.pointerType === 'touch' || event.pointerType === 'pen')) {
      const anchor = caretFromPoint(event.clientX, event.clientY);
      const container = pageMetrics()?.element;
      if (!anchor || !container?.contains(anchor.startContainer)) return;
      event.preventDefault();
      highlighterAnchorRef.current = { node: anchor.startContainer, offset: anchor.startOffset };
      activePointerRef.current = { mode: 'highlighter', pointerId: event.pointerId };
      try { wrapperRef.current?.setPointerCapture(event.pointerId); } catch { /* unsupported browser */ }
      setSelectionBetween(anchor.startContainer, anchor.startOffset, anchor.startContainer, anchor.startOffset);
      return;
    }
    if (activeTool === 'highlighter') {
      activePointerRef.current = { mode: 'native-highlighter', pointerId: event.pointerId };
      return;
    }
    if (activeTool === 'select') {
      activePointerRef.current = { mode: 'native-select', pointerId: event.pointerId };
      return;
    }
    if (activeTool !== 'eraser') return;
    event.preventDefault();
    activePointerRef.current = { mode: 'eraser', pointerId: event.pointerId, path: [] };
    try { wrapperRef.current?.setPointerCapture(event.pointerId); } catch { /* unsupported browser */ }
    appendEraserSamples(event);
    updateEraserHover(event);
  }, [activeTool, appendEraserSamples, pageMetrics, updateEraserHover]);

  const onWrapperPointerMove = useCallback((event) => {
    const active = activePointerRef.current;
    if (active?.pointerId === event.pointerId && active.mode === 'highlighter') {
      event.preventDefault();
      pendingHighlightPointRef.current = { x: event.clientX, y: event.clientY };
      if (!highlightRafRef.current) {
        highlightRafRef.current = requestAnimationFrame(() => {
          highlightRafRef.current = 0;
          const point = pendingHighlightPointRef.current;
          if (point) applyHighlighterPoint(point.x, point.y);
        });
      }
      return;
    }
    if (activeTool !== 'eraser') return;
    updateEraserHover(event);
    if (active?.pointerId === event.pointerId && active.mode === 'eraser') {
      event.preventDefault();
      appendEraserSamples(event);
    }
  }, [activeTool, appendEraserSamples, applyHighlighterPoint, updateEraserHover]);

  const cancelPointer = useCallback((event) => {
    const active = activePointerRef.current;
    if (!active || (event.pointerId !== undefined && event.pointerId !== active.pointerId)) return;
    activePointerRef.current = null;
    highlighterAnchorRef.current = null;
    pendingHighlightPointRef.current = null;
    if (highlightRafRef.current) cancelAnimationFrame(highlightRafRef.current);
    highlightRafRef.current = 0;
    releasePointer(active.pointerId);
  }, [releasePointer]);

  const onWrapperPointerUp = useCallback((event) => {
    if (activePointerRef.current) {
      finalizePointer(event);
      return;
    }
    if (activeTool === 'select' || activeTool === 'highlighter') {
      requestAnimationFrame(finishSelection);
    }
  }, [activeTool, finalizePointer, finishSelection]);

  useEffect(() => () => {
    if (eraserRafRef.current) cancelAnimationFrame(eraserRafRef.current);
    if (highlightRafRef.current) cancelAnimationFrame(highlightRafRef.current);
  }, []);

  const onPageLoadSuccess = useCallback((page) => {
    const viewport = page.getViewport({ scale });
    setPageSize({ width: viewport.width, height: viewport.height });
    if (typeof onPageTextReady !== 'function' || typeof page.getTextContent !== 'function') return;
    const key = `${fileUrl}::${pageNumber}`;
    if (extractedForKeyRef.current === key) return;
    extractedForKeyRef.current = key;
    page.getTextContent()
      .then((content) => onPageTextReady((content?.items || []).map((item) => item?.str || '').filter(Boolean).join(' ')))
      .catch(() => onPageTextReady(''));
  }, [fileUrl, onPageTextReady, pageNumber, scale]);

  useEffect(() => { extractedForKeyRef.current = null; }, [fileUrl, pageNumber]);

  const handleStrokeCommit = useCallback((stroke) => {
    onAnnotate?.({
      type: 'pen',
      color: stroke.color,
      points: stroke.points,
      strokeWidth: stroke.baseWidth,
      referenceWidth: stroke.referenceWidth
    });
  }, [onAnnotate]);

  const handleCreateHighlight = useCallback(async (color, note) => {
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
  }, [onAddHighlight, pageNumber, selectionPopup]);

  const wrapperClass = [
    'rb-pdf-page-wrap',
    activeTool === 'pen' ? 'rb-pdf-page-wrap--pen' : '',
    activeTool === 'eraser' ? 'rb-pdf-page-wrap--eraser' : '',
    activeTool === 'highlighter' ? 'rb-pdf-page-wrap--highlighter' : ''
  ].filter(Boolean).join(' ');

  return (
    <div
      className={wrapperClass}
      ref={wrapperRef}
      onPointerDown={onWrapperPointerDown}
      onPointerUp={onWrapperPointerUp}
      onPointerCancel={cancelPointer}
      onLostPointerCapture={cancelPointer}
      onPointerMove={onWrapperPointerMove}
      onPointerLeave={() => {
        if (!activePointerRef.current && activeTool === 'eraser') {
          annotationCanvasRef.current?.setEraserHover(null);
        }
      }}
    >
      <div className="rb-pdf-page-inner">
        <Document
          file={documentFile}
          onLoadSuccess={onDocumentLoad}
          onLoadError={onDocumentError}
          loading={<div className="rb-pdf-loading"><p>{t('rb.reader.loading')}</p></div>}
          error={null}
        >
          <div className="rb-pdf-page-container">
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer
              renderAnnotationLayer={false}
              onLoadSuccess={onPageLoadSuccess}
              loading={<div className="rb-pdf-loading"><p>{t('rb.reader.loading')}</p></div>}
              error={<div className="rb-pdf-error"><p>{t('rb.reader.pdf_error')}</p></div>}
              className="rb-pdf-page"
            />
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
              onHighlightClick={(highlight, event) => {
                if ((activeTool === 'select' || activeTool === 'highlighter') && highlight.note) {
                  setActiveNotePopup({ note: highlight.note, position: { x: event.clientX, y: event.clientY } });
                }
              }}
            />
            {selectionPopup && (
              <HighlightPopup
                position={selectionPopup.position}
                onHighlight={handleCreateHighlight}
                onSummarize={(typedNote) => {
                  onSummarizeSelection?.({
                    text: selectionPopup.text,
                    pageNumber,
                    note: typedNote || ''
                  });
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
            left: `${clamp(activeNotePopup.position.x + 10, 12, window.innerWidth - 312)}px`,
            top: `${clamp(activeNotePopup.position.y + 10, 12, window.innerHeight - 100)}px`,
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
          <p style={{ margin: 0, fontSize: '14px', color: '#333', lineHeight: 1.4 }}>{activeNotePopup.note}</p>
        </div>
      )}
    </div>
  );
}
