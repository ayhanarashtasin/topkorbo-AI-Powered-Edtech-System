import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import {
  HiCursorClick,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineBookOpen,
  HiOutlineHand,
  HiOutlineBookmark,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineZoomIn,
  HiOutlineZoomOut,
  HiOutlineAdjustments
} from 'react-icons/hi';
import { LuUndo2, LuRedo2, LuEraser, LuHighlighter } from 'react-icons/lu';
import './ReaderToolbar.css';

// Pen colors shown in the toolbar swatches.
const PEN_COLORS = [
  { id: 'red',    value: '#EF4444' },
  { id: 'blue',   value: '#3B82F6' },
  { id: 'black',  value: '#111827' },
  { id: 'orange', value: '#F59E0B' }
];

// Pen stroke widths in CSS px — small / medium / large.
const PEN_SIZES = [
  { id: 'small',  value: 1.5, labelKey: 'rb.reader.sizes.small' },
  { id: 'medium', value: 3,   labelKey: 'rb.reader.sizes.medium' },
  { id: 'large',  value: 5,   labelKey: 'rb.reader.sizes.large' }
];

const ERASER_SIZES = [
  { id: 'small', value: 8, dotSize: 6 },
  { id: 'medium', value: 16, dotSize: 10 },
  { id: 'large', value: 32, dotSize: 14 }
];

export default function ReaderToolbar({
  activeTool,
  onToolChange,
  penColor,
  onPenColorChange,
  penWidth,
  onPenWidthChange,
  pressureSimEnabled,
  onPressureSimToggle,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onToggleBookmark,
  isBookmarked,
  scale,
  onZoomIn,
  onZoomOut,
  pageNumber,
  pageCount,
  onPrevPage,
  onNextPage,
  toolHint,
  eraserType = 'stroke',
  onEraserTypeChange,
  eraserWidth = 16,
  onEraserWidthChange,
  onClearPage,
  onPageChange,
  canAnnotate = true
}) {
  const { t } = useLanguage();
  const [openPopover, setOpenPopover] = useState(null);
  const eraserTypeRef = useRef(null);
  const eraserSettingsRef = useRef(null);
  const [pageInputVal, setPageInputVal] = useState(String(pageNumber));

  useEffect(() => {
    setPageInputVal(String(pageNumber));
  }, [pageNumber]);

  const triggerPageChange = (val) => {
    const parsed = parseInt(val, 10);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= (pageCount || 1)) {
      onPageChange?.(parsed);
    } else {
      setPageInputVal(String(pageNumber));
    }
  };

  const handlePageInputChange = (e) => {
    setPageInputVal(e.target.value);
  };

  const handlePageInputBlur = () => {
    triggerPageChange(pageInputVal);
  };

  const handlePageInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      triggerPageChange(pageInputVal);
      e.target.blur();
    } else if (e.key === 'Escape') {
      setPageInputVal(String(pageNumber));
      e.target.blur();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openPopover === 'eraserType' && eraserTypeRef.current && !eraserTypeRef.current.contains(event.target)) {
        setOpenPopover(null);
      }
      if (openPopover === 'eraserSettings' && eraserSettingsRef.current && !eraserSettingsRef.current.contains(event.target)) {
        setOpenPopover(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openPopover]);

  // Pen / highlighter / eraser are Pro+ reading tools. Free & Pro readers see
  // only the (read-only) select cursor; the annotation APIs are enforced
  // server-side regardless.
  const allTools = [
    { id: 'select',      icon: <HiCursorClick size={16} />,    label: t('rb.reader.tools.select') },
    { id: 'pen',         icon: <HiOutlinePencil size={16} />,  label: t('rb.reader.tools.pen') },
    { id: 'highlighter', icon: <LuHighlighter size={16} />,    label: 'Highlight' },
    { id: 'eraser',      icon: <LuEraser size={16} />,         label: t('rb.reader.tools.eraser') }
  ];
  const tools = canAnnotate ? allTools : allTools.filter((tl) => tl.id === 'select');

  const hintByTool = {
    pen: t('rb.reader.pen.draw') || t('rb.reader.draw_to_pen'),
    highlighter: 'Select text to highlight',
    eraser: eraserType === 'stroke' ? (t('rb.reader.click_to_erase') || 'Click to erase stroke') : 'Drag to erase partially'
  };
  const hint = toolHint || hintByTool[activeTool] || '';

  return (
    <div className="rb-toolbar">
      <div className="rb-toolbar__group">
        {tools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={`rb-toolbar__btn ${activeTool === tool.id ? 'rb-toolbar__btn--active' : ''}`}
            onClick={() => onToolChange(tool.id)}
            title={hintByTool[tool.id] || tool.label}
            aria-label={tool.label}
          >
            {tool.icon}
            <span className="rb-toolbar__btn-label">{tool.label}</span>
          </button>
        ))}
        {!canAnnotate && (
          <a
            href="/pricing"
            title="Pen, highlighter & notes are a Pro+ feature"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#8C5A3C',
              textDecoration: 'none',
              padding: '4px 10px',
              borderRadius: 8,
              background: '#f6efe8',
              whiteSpace: 'nowrap'
            }}
          >
            🔒 Upgrade for tools
          </a>
        )}
      </div>

      {(activeTool === 'pen' || activeTool === 'highlighter') && (
        <div className="rb-toolbar__group rb-toolbar__colors" role="group" aria-label="Tool colors">
          {PEN_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`rb-toolbar__pen-swatch ${
                penColor === c.value ? 'rb-toolbar__pen-swatch--active' : ''
              }`}
              style={{ background: c.value }}
              onClick={() => onPenColorChange(c.value)}
              aria-label={c.id}
            />
          ))}
        </div>
      )}

      {activeTool === 'pen' && (
        <>
          <div className="rb-toolbar__group rb-toolbar__sizes" role="group" aria-label="Pen sizes">
            {PEN_SIZES.map((s) => {
              const active = Math.abs((penWidth || 3) - s.value) < 0.01;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`rb-toolbar__size ${active ? 'rb-toolbar__size--active' : ''}`}
                  onClick={() => onPenWidthChange(s.value)}
                  title={t(s.labelKey)}
                  aria-label={t(s.labelKey)}
                >
                  <span
                    className="rb-toolbar__size-dot"
                    style={{
                      width: Math.max(4, s.value * 1.6),
                      height: Math.max(4, s.value * 1.6),
                      background: penColor
                    }}
                  />
                  <span className="rb-toolbar__btn-label">{t(s.labelKey)}</span>
                </button>
              );
            })}
          </div>

          <div className="rb-toolbar__group">
            <button
              type="button"
              className={`rb-toolbar__btn ${pressureSimEnabled ? 'rb-toolbar__btn--active' : ''}`}
              onClick={onPressureSimToggle}
              title={t('rb.reader.pen.pressure')}
              aria-label={t('rb.reader.pen.pressure')}
            >
              <HiOutlineAdjustments size={16} />
              <span className="rb-toolbar__btn-label">{t('rb.reader.pen.pressure')}</span>
            </button>
          </div>
        </>
      )}

      {activeTool === 'eraser' && (
        <div className="rb-toolbar__group" role="group" aria-label="Eraser mode">
          <div className="rb-eraser-group" ref={eraserTypeRef}>
            <button
              type="button"
              className={`rb-toolbar__btn ${openPopover === 'eraserType' ? 'rb-toolbar__btn--active' : ''}`}
              onClick={() => setOpenPopover(openPopover === 'eraserType' ? null : 'eraserType')}
              aria-label="Toggle Eraser Type"
            >
              <LuEraser size={16} />
              <span className="rb-toolbar__btn-label">
                {eraserType === 'stroke'
                  ? (t('rb.reader.eraser.stroke') || 'Stroke')
                  : (t('rb.reader.eraser.standard') || 'Standard')}
              </span>
              <span style={{ fontSize: 9, marginLeft: 2, color: '#8C5A3C' }}>▼</span>
            </button>

            {openPopover === 'eraserType' && (
              <div className="rb-eraser-popover">
                <div className="rb-eraser-popover__title">
                  {eraserType === 'stroke' ? 'Stroke Type' : 'Standard Type'}
                </div>
                <div className="rb-eraser-popover__cards">
                  <div
                    className={`rb-eraser-card ${eraserType === 'standard' ? 'rb-eraser-card--active' : ''}`}
                    onClick={() => {
                      onEraserTypeChange('standard');
                      setOpenPopover(null);
                    }}
                  >
                    <div className="rb-eraser-card__icon-wrapper">
                      <LuEraser size={20} color="#8C5A3C" />
                    </div>
                    <div className="rb-eraser-card__label">Standard Eraser</div>
                  </div>

                  <div
                    className={`rb-eraser-card ${eraserType === 'stroke' ? 'rb-eraser-card--active' : ''}`}
                    onClick={() => {
                      onEraserTypeChange('stroke');
                      setOpenPopover(null);
                    }}
                  >
                    <div className="rb-eraser-card__icon-wrapper">
                      <LuEraser size={20} color="#8C5A3C" style={{ opacity: 0.6 }} />
                    </div>
                    <div className="rb-eraser-card__label">Stroke Eraser</div>
                  </div>
                </div>
                <div className="rb-eraser-popover__caption">
                  {eraserType === 'standard'
                    ? 'Efficient erasing without leaving any marks'
                    : 'Erase a whole stroke at a time'}
                </div>
              </div>
            )}
          </div>

          <div className="rb-eraser-inner-divider" />

          <div className="rb-eraser-sizes">
            {ERASER_SIZES.map((size) => {
              const isActive = eraserWidth === size.value;
              return (
                <button
                  key={size.id}
                  type="button"
                  className={`rb-eraser-size-btn ${isActive ? 'rb-eraser-size-btn--active' : ''}`}
                  onClick={() => onEraserWidthChange(size.value)}
                  title={`Eraser size: ${size.id}`}
                  aria-label={`Eraser size: ${size.id}`}
                >
                  <span
                    className="rb-eraser-size-dot"
                    style={{
                      width: size.dotSize,
                      height: size.dotSize
                    }}
                  />
                </button>
              );
            })}
          </div>

          <div className="rb-eraser-inner-divider" />

          <div className="rb-eraser-group" ref={eraserSettingsRef}>
            <button
              type="button"
              className={`rb-toolbar__btn rb-toolbar__btn--icon ${openPopover === 'eraserSettings' ? 'rb-toolbar__btn--active' : ''}`}
              onClick={() => setOpenPopover(openPopover === 'eraserSettings' ? null : 'eraserSettings')}
              title="Eraser Settings"
              aria-label="Eraser Settings"
            >
              <HiOutlineAdjustments size={16} />
            </button>

            {openPopover === 'eraserSettings' && (
              <div className="rb-eraser-settings-popover">
                <div className="rb-eraser-settings-popover__title">Eraser Settings</div>
                <button
                  type="button"
                  className="rb-eraser-clear-btn"
                  onClick={() => {
                    onClearPage();
                    setOpenPopover(null);
                  }}
                >
                  Clear Page
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rb-toolbar__divider" />

      {/* Undo / Redo — always rendered (disabled when empty) so the
          toolbar layout doesn't shift when history becomes available. */}
      <div className="rb-toolbar__group">
        <button
          type="button"
          className="rb-toolbar__btn rb-toolbar__btn--icon"
          onClick={onUndo}
          disabled={!canUndo}
          title={`${t('rb.reader.tools.undo')} (Ctrl+Z)`}
          aria-label={t('rb.reader.tools.undo')}
        >
          <LuUndo2 size={16} />
        </button>
        <button
          type="button"
          className="rb-toolbar__btn rb-toolbar__btn--icon"
          onClick={onRedo}
          disabled={!canRedo}
          title={`${t('rb.reader.tools.redo')} (Ctrl+Y)`}
          aria-label={t('rb.reader.tools.redo')}
        >
          <LuRedo2 size={16} />
        </button>
      </div>

      <div className="rb-toolbar__divider" />

      <div className="rb-toolbar__group">
        <button
          type="button"
          className="rb-toolbar__btn rb-toolbar__btn--icon"
          onClick={onPrevPage}
          disabled={pageNumber <= 1}
          title={t('rb.reader.prev')}
          aria-label={t('rb.reader.prev')}
        >
          <HiOutlineChevronLeft size={16} />
        </button>
        <span className="rb-toolbar__pages">
          <input
            type="text"
            className="rb-toolbar__page-input"
            value={pageInputVal}
            onChange={handlePageInputChange}
            onBlur={handlePageInputBlur}
            onKeyDown={handlePageInputKeyDown}
            aria-label="Go to page"
          />
          <span className="rb-toolbar__page-count">/ {pageCount || 1}</span>
        </span>
        <button
          type="button"
          className="rb-toolbar__btn rb-toolbar__btn--icon"
          onClick={onNextPage}
          disabled={pageNumber >= (pageCount || 1)}
          title={t('rb.reader.next')}
          aria-label={t('rb.reader.next')}
        >
          <HiOutlineChevronRight size={16} />
        </button>
      </div>

      <div className="rb-toolbar__divider" />

      <div className="rb-toolbar__group">
        <button
          type="button"
          className="rb-toolbar__btn rb-toolbar__btn--icon"
          onClick={onZoomOut}
          title={t('rb.reader.zoom_out')}
          aria-label={t('rb.reader.zoom_out')}
        >
          <HiOutlineZoomOut size={16} />
        </button>
        <span className="rb-toolbar__zoom-val">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          className="rb-toolbar__btn rb-toolbar__btn--icon"
          onClick={onZoomIn}
          title={t('rb.reader.zoom_in')}
          aria-label={t('rb.reader.zoom_in')}
        >
          <HiOutlineZoomIn size={16} />
        </button>
      </div>

      <div className="rb-toolbar__divider" />

      <button
        type="button"
        className={`rb-toolbar__btn ${isBookmarked ? 'rb-toolbar__btn--bookmarked' : ''}`}
        onClick={onToggleBookmark}
        title={t('rb.reader.bookmark')}
        aria-label={t('rb.reader.bookmark')}
      >
        <HiOutlineBookmark size={16} />
        <span className="rb-toolbar__btn-label">
          {isBookmarked ? t('rb.reader.bookmarked') : t('rb.reader.bookmark')}
        </span>
      </button>

      {hint && (
        <div className="rb-toolbar__hint">
          <HiOutlineBookOpen size={14} />
          <span>{hint}</span>
        </div>
      )}
    </div>
  );
}
