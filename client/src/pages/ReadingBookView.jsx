import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { useDebouncedAutoSave } from '../hooks/useDebouncedAutoSave';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useAnnotationAutosave } from '../hooks/useAnnotationAutosave';
import { annotationApi } from '../services/annotationApi';
import Sidebar from '../components/layout/Sidebar';
import ChapterNav from '../components/reader/ChapterNav';
import ReaderToolbar from '../components/reader/ReaderToolbar';
import PdfCanvas from '../components/reader/PdfCanvas';
import HighlightSidebar from '../components/reader/HighlightSidebar';
import { useHighlights } from '../hooks/useHighlights';
import ErrorBoundary from '../components/layout/ErrorBoundary';
import {
  HiMenu,
  HiArrowLeft,
  HiOutlineLightBulb
} from 'react-icons/hi';
import toast from 'react-hot-toast';
import './ReadingBookView.css';

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;

export default function ReadingBookView() {
  const { bookId, chapterId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Student',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [chapter, setChapter] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [pdfError, setPdfError] = useState(false);

  const [pageNumber, setPageNumber] = useState(() => {
    const p = parseInt(searchParams.get('page') || '1', 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.1);
  const [activeTool, setActiveTool] = useState('select');
  const [penColor, setPenColor] = useState('#EF4444');
  const [penWidth, setPenWidth] = useState(3);
  const [pressureSimEnabled, setPressureSimEnabled] = useState(true);
  const [allAnnotations, setAllAnnotations] = useState([]); // current chapter
  const [readingState, setReadingState] = useState(null);
  const [isNavOpen, setIsNavOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [isHighlightSidebarOpen, setIsHighlightSidebarOpen] = useState(false);
  const [eraserType, setEraserType] = useState('stroke'); // 'stroke' | 'standard'
  const [eraserWidth, setEraserWidth] = useState(16); // 8 | 16 | 32

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const saveInProgressRef = useRef(false);

  const { highlights, addHighlight, deleteHighlight, updateHighlight } = useHighlights({ bookId, chapterId, apiBase });

  /* ---------- Undo/Redo history (per-page, in-memory) ----------
   * We use a command stack keyed by page: `present` is the list of
   * annotations for the current page. The consumer (this file) pushes
   * actions for "draw a stroke" and "erase a stroke" — the hook
   * applies the action's `do` to `present`, and `undo` / `redo`
   * re-apply `undo` / `do` respectively.
   *
   * `reset(...)` is called whenever the visible page changes, which
   * clears both stacks (the spec's "per-page in-memory only" rule).
   */
  const history = useUndoRedo({ limit: 200 });

  // The list of annotations the canvas should display. For pen
  // strokes this is `history.present`; for text-anchored annotations
  // we still use the server-fetched list (they aren't undoable in
  // this iteration, to avoid scope creep).
  const pageAnnotations = useMemo(
    () => allAnnotations.filter((a) => Number(a.pageNumber) === Number(pageNumber)),
    [allAnnotations, pageNumber]
  );

  // Merge the undoable pen strokes (from history) with the non-undoable
  // annotations (from the server fetch) into a single list.
  const visiblePageAnnotations = useMemo(() => {
    const pen = history.present;
    const others = pageAnnotations.filter((a) => a.type !== 'pen');
    return [...others, ...pen];
  }, [history.present, pageAnnotations]);

  // When the user navigates to a different page, reset the history to
  // the current set of server-known pen strokes.
  useEffect(() => {
    const serverPens = pageAnnotations.filter((a) => a.type === 'pen');
    history.reset(serverPens);
    // We intentionally do NOT depend on `history.reset` identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, chapterId]);

  /* ---------- Autosave (bulk POST every 5s) ----------
   * The autosave hook owns a queue of pen strokes that need to be
   * POSTed. On each enqueue it schedules a debounced flush; we
   * additionally call `flush()` on page change and on
   * `beforeunload` so nothing is lost.
   *
   * On a successful bulk POST the hook calls `onSaved(inserted)` with
   * the server-returned documents. We use those to update the server
   * list — but we DO NOT remove the local optimistic entry, because
   * the local optimistic stroke is what `history.present` already
   * contains, and the canvas renders from that. We just add the
   * server `_id` to the corresponding stroke in `allAnnotations` so
   * future operations (eraser, bulk-delete) can find it.
   */
  const autosave = useAnnotationAutosave({
    bookId,
    chapterId,
    pageNumber,
    serverStrokes: pageAnnotations.filter((a) => a.type === 'pen'),
    delay: 5000,
    onSaved: (inserted) => {
      // Reconcile optimistic local IDs with real server IDs in allAnnotations
      setAllAnnotations((prev) => {
        return prev.map((local) => {
          if (!local._id.startsWith('local-')) return local;
          const match = inserted.find((srv) => 
            srv.color === local.color &&
            srv.strokeWidth === local.strokeWidth &&
            srv.points.length === local.points.length &&
            Math.abs((srv.points[0]?.x || 0) - (local.points[0]?.x || 0)) < 0.0001
          );
          return match ? { ...local, _id: match._id } : local;
        });
      });

      // Reconcile optimistic local IDs with real server IDs in history.present
      history.setPresent((prev) => {
        return prev.map((local) => {
          if (!local._id.startsWith('local-')) return local;
          const match = inserted.find((srv) => 
            srv.color === local.color &&
            srv.strokeWidth === local.strokeWidth &&
            srv.points.length === local.points.length &&
            Math.abs((srv.points[0]?.x || 0) - (local.points[0]?.x || 0)) < 0.0001
          );
          return match ? { ...local, _id: match._id } : local;
        });
      });
    },
    onError: (err) => {
      // eslint-disable-next-line no-console
      console.error('Annotation autosave failed:', err);
      toast.error(t('rb.reader.error.save') || 'Failed to save annotations');
    }
  });

  // Auth guard (unchanged)
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) {
      window.location.href = '/';
      return;
    }
    const fetchUser = async () => {
      try {
        const res = await fetch(`${apiBase}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) {
          localStorage.removeItem('topkorbo_token');
          window.location.href = '/';
          return;
        }
        const data = await res.json();
        if (data.success && data.data) {
          setUser({
            name: data.data.name,
            avatar: data.data.avatar || '',
            email: data.data.email,
            role: data.data.role
          });
          localStorage.setItem('topkorbo_name', data.data.name);
          localStorage.setItem('topkorbo_avatar', data.data.avatar || '');
          localStorage.setItem('topkorbo_email', data.data.email);
          localStorage.setItem('topkorbo_role', data.data.role);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error fetching user data:', err);
      }
    };
    fetchUser();
  }, [apiBase]);

  // Fetch book + chapters + chapter meta + annotations + reading state
  useEffect(() => {
    if (!bookId || !chapterId) return;
    let cancelled = false;
    setLoadingMeta(true);
    setPdfError(false);
    setNumPages(0);

    const token = localStorage.getItem('topkorbo_token');
    const headers = { Authorization: `Bearer ${token}` };

    // 1. Fetch chapter metadata (CRITICAL blocker for rendering PDF canvas)
    (async () => {
      try {
        const res = await fetch(`${apiBase}/books/${bookId}/chapters/${chapterId}`, { headers });
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.data?.chapter) {
          setChapter(data.data.chapter);
          setLoadingMeta(false); // Render the reader interface and start loading the PDF!
        } else {
          throw new Error(data.message || 'Failed to load chapter');
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading chapter:', err);
        if (!cancelled) {
          setPdfError(true);
          setLoadingMeta(false);
        }
        toast.error(t('rb.reader.error.load'));
      }
    })();

    // 2. Fetch book details (non-blocking, sidebar/chapter list)
    (async () => {
      try {
        const res = await fetch(`${apiBase}/books/${bookId}`, { headers });
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.data) {
          setBook(data.data);
          setChapters(data.data.chapters || []);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading book details:', err);
      }
    })();

    // 3. Fetch annotations (non-blocking, overlays)
    (async () => {
      try {
        const res = await fetch(`${apiBase}/books/annotations?chapterId=${chapterId}`, { headers });
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.data) {
          setAllAnnotations(data.data.annotations || []);
        } else {
          setAllAnnotations([]);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading annotations:', err);
      }
    })();

    // 4. Fetch reading state (non-blocking, page number progress / bookmarks)
    (async () => {
      try {
        const res = await fetch(`${apiBase}/books/reading-state?bookId=${bookId}&chapterId=${chapterId}`, { headers });
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.data) {
          setReadingState(data.data);
          if (!searchParams.get('page') && data.data.lastPage) {
            setPageNumber(data.data.lastPage);
          }
        } else {
          setReadingState(null);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading reading state:', err);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, chapterId, apiBase]);

  // Sync ?page= in URL when pageNumber changes
  useEffect(() => {
    const current = searchParams.get('page');
    if (String(pageNumber) === current) return;
    const next = new URLSearchParams(searchParams);
    next.set('page', String(pageNumber));
    setSearchParams(next, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber]);

  // ---- Autosave reading state (lastPage) ----
  const saveReadingState = useDebouncedAutoSave(async (nextPage) => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) return;
    try {
      saveInProgressRef.current = true;
      await fetch(`${apiBase}/books/reading-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          bookId,
          chapterId,
          lastPage: nextPage
        })
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to save reading state:', err);
    } finally {
      saveInProgressRef.current = false;
    }
  }, 1200);

  useEffect(() => {
    if (loadingMeta) return;
    saveReadingState(pageNumber);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, loadingMeta]);

  /* ---------- Flush pen autosave on page change ----------
   * When the user navigates to a different page, we want any queued
   * strokes to be POSTed against the OLD page, not the new one. The
   * autosave hook's own effect clears its queue on `pageNumber` change,
   * so we flush BEFORE updating `pageNumber`. The `handlePrevPage` /
   * `handleNextPage` callbacks below call this in the right order.
   */
  const pageNumberRef = useRef(pageNumber);
  useEffect(() => { pageNumberRef.current = pageNumber; }, [pageNumber]);



  const flushPenAutosave = useCallback(async () => {
    try { await autosave.flush(); } catch (_) { /* best-effort */ }
  }, [autosave]);

  /* ---------- Annotation handlers ---------- */
  const handleAnnotate = useCallback(async (payload) => {
    if (payload.type === 'pen') {
      // Push a draw action onto the undo stack and queue for autosave.
      const optimisticId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newStroke = {
        _id: optimisticId,
        pageNumber,
        type: 'pen',
        color: payload.color,
        strokeWidth: payload.strokeWidth,
        points: payload.points
      };
      history.push({
        label: 'draw',
        do: (state) => [...state, newStroke],
        undo: (state) => state.filter((s) => s._id !== optimisticId)
      });
      autosave.enqueue({
        type: 'pen',
        color: payload.color,
        strokeWidth: payload.strokeWidth,
        points: payload.points,
        clientId: optimisticId
      });
      return;
    }


  }, [autosave, bookId, chapterId, history, pageNumber, apiBase, t]);

  // Eraser click on a pen stroke. We:
  //  1) Push an "erase" action onto the right undo stack (so Ctrl+Z restores it)
  //  2) Issue an immediate DELETE so the server catches up
  //  3) On 4xx/5xx, undo the optimistic removal
  const handleAnnotationClick = useCallback(async (item) => {
    if (activeTool !== 'eraser') return;
    if (!item) return;

    // Pen stroke eraser: optimistic + undoable.
    const id = item._id;
    if (!id) return;
    history.push({
      label: 'erase',
      do: (state) => state.filter((s) => s._id !== id),
      undo: (state) => {
        if (state.some((s) => s._id === id)) return state;
        return [...state, item];
      }
    });
    // If the stroke is a local placeholder (no server _id yet), we
    // don't need to DELETE — the autosave queue can be left alone and
    // the next flush will skip it. The cleanest fix is to remove it
    // from the queue too, but the autosave hook doesn't expose that
    // here. The user-visible effect is the stroke disappearing from
    // the canvas (history undo handles that) and the autosave
    // attempting to POST a deleted stroke — which fails harmlessly
    // because the bulk endpoint validates the entry.
    if (id.startsWith('local-')) return;

    try {
      await annotationApi.remove(id);
      setAllAnnotations((prev) => prev.filter((a) => a._id !== id));
    } catch (err) {
      // Server rejected the delete. Roll back the local state.
      // eslint-disable-next-line no-console
      console.error('Failed to delete annotation:', err);
      history.undo();
      toast.error(t('rb.reader.error.network'));
    }
  }, [activeTool, history, t]);

  const handleAnnotationPartialErase = useCallback(async (originalStroke, newSegments) => {
    const originalId = originalStroke._id;
    if (!originalId) return;

    // Create optimistic segments with new IDs
    const optimisticSegments = newSegments.map((points) => {
      const newId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        _id: newId,
        pageNumber,
        type: 'pen',
        color: originalStroke.color,
        strokeWidth: originalStroke.strokeWidth,
        points
      };
    });

    // Push action onto history stack
    history.push({
      label: 'partial-erase',
      do: (state) => {
        const filtered = state.filter((s) => s._id !== originalId);
        return [...filtered, ...optimisticSegments];
      },
      undo: (state) => {
        const newIds = optimisticSegments.map((s) => s._id);
        const filtered = state.filter((s) => !newIds.includes(s._id));
        return [...filtered, originalStroke];
      }
    });

    // Delete the original stroke from database/server list
    if (!originalId.startsWith('local-')) {
      try {
        await annotationApi.remove(originalId);
        setAllAnnotations((prev) => prev.filter((a) => a._id !== originalId));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to delete original stroke for partial erase:', err);
      }
    }

    // Enqueue all newly created segments to autosave
    optimisticSegments.forEach((seg) => {
      autosave.enqueue({
        type: 'pen',
        color: seg.color,
        strokeWidth: seg.strokeWidth,
        points: seg.points,
        clientId: seg._id
      });
    });
  }, [autosave, history, pageNumber]);

  const handleHighlightPartialEraseEnd = useCallback(async (modifications) => {
    // modifications is a dictionary of { [id]: newRectsArray }
    for (const [id, newRects] of Object.entries(modifications)) {
      if (newRects.length === 0) {
        deleteHighlight(id);
      } else {
        updateHighlight(id, { rects: newRects });
      }
    }
  }, [deleteHighlight, updateHighlight]);

  const handleClearPage = useCallback(async () => {
    const pageAnns = visiblePageAnnotations;
    if (pageAnns.length === 0) return;

    setAllAnnotations((prev) => prev.filter((a) => Number(a.pageNumber) !== Number(pageNumber)));
    history.reset([]);

    const serverIds = pageAnns
      .filter((a) => a._id && !a._id.startsWith('local-'))
      .map((a) => a._id);

    if (serverIds.length > 0) {
      try {
        await annotationApi.bulkDelete(serverIds);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to clear page annotations from server:', err);
        toast.error(t('rb.reader.error.network'));
      }
    }
    toast.success(t('rb.reader.clear_success') || 'Page cleared');
  }, [visiblePageAnnotations, pageNumber, history, t]);

  /* ---------- Undo / Redo wrappers for the toolbar ---------- */
  const undo = useCallback(() => {
    if (history.canUndo) {
      history.undo();
      autosave.schedule();
    }
  }, [autosave, history]);

  const redo = useCallback(() => {
    if (history.canRedo) {
      history.redo();
      autosave.schedule();
    }
  }, [autosave, history]);

  const toolbarCanUndo = history.canUndo;
  const toolbarCanRedo = history.canRedo;

  /* ---------- Chapter navigation ---------- */
  const currentChapterIndex = useMemo(
    () => chapters.findIndex((c) => String(c._id) === String(chapterId)),
    [chapters, chapterId]
  );
  const hasPrevChapter = currentChapterIndex > 0;
  const hasNextChapter = currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1;

  const goPrevChapter = () => {
    if (!hasPrevChapter) return;
    flushPenAutosave();
    const prev = chapters[currentChapterIndex - 1];
    navigate(`/reading-books/${bookId}/${prev._id}?page=1`);
  };
  const goNextChapter = () => {
    if (!hasNextChapter) return;
    flushPenAutosave();
    const next = chapters[currentChapterIndex + 1];
    navigate(`/reading-books/${bookId}/${next._id}?page=1`);
  };

  /* ---------- Page nav (with autosave flush) ---------- */
  const handlePrevPage = useCallback(() => {
    flushPenAutosave();
    setPageNumber((p) => Math.max(1, p - 1));
  }, [flushPenAutosave]);

  const handleNextPage = useCallback(() => {
    flushPenAutosave();
    setPageNumber((p) => Math.min(numPages || p, p + 1));
  }, [flushPenAutosave, numPages]);

  const handlePageChange = useCallback((newPage) => {
    flushPenAutosave();
    setPageNumber(newPage);
  }, [flushPenAutosave]);

  const handleZoomIn = () => setScale((s) => Math.min(MAX_SCALE, +(s + 0.15).toFixed(2)));
  const handleZoomOut = () => setScale((s) => Math.max(MIN_SCALE, +(s - 0.15).toFixed(2)));

  /* ---------- Bookmarks ---------- */
  const isBookmarked = useMemo(() => {
    const bms = readingState?.bookmarks || [];
    return bms.some((bm) => Number(bm.pageNumber) === Number(pageNumber));
  }, [readingState, pageNumber]);

  const handleToggleBookmark = useCallback(async () => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) return;
    if (isBookmarked) {
      const bm = (readingState?.bookmarks || []).find(
        (b) => Number(b.pageNumber) === Number(pageNumber)
      );
      if (!bm) return;
      try {
        const res = await fetch(
          `${apiBase}/books/reading-state/bookmark/${bm._id}?bookId=${bookId}&chapterId=${chapterId}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        const data = await res.json();
        if (data.success) {
          setReadingState((prev) => prev
            ? { ...prev, bookmarks: (prev.bookmarks || []).filter((b) => b._id !== bm._id) }
            : prev
          );
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to remove bookmark:', err);
      }
      return;
    }
    try {
      const res = await fetch(`${apiBase}/books/reading-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          bookId,
          chapterId,
          bookmark: { pageNumber, label: '' }
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setReadingState(data.data);
        toast.success(t('rb.reader.bookmark') + ' ✓');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to add bookmark:', err);
    }
  }, [apiBase, bookId, chapterId, isBookmarked, pageNumber, readingState, t]);

  const handleSelectBookmark = (bm) => {
    flushPenAutosave();
    setPageNumber(bm.pageNumber);
    setIsNavOpen(false);
  };

  const handleClearBookmark = async (bm) => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) return;
    try {
      const res = await fetch(
        `${apiBase}/books/reading-state/bookmark/${bm._id}?bookId=${bookId}&chapterId=${chapterId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const data = await res.json();
      if (data.success) {
        setReadingState((prev) => prev
          ? { ...prev, bookmarks: (prev.bookmarks || []).filter((b) => b._id !== bm._id) }
          : prev
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to remove bookmark:', err);
    }
  };

  const fileUrl = chapter?.fileUrl
    ? (chapter.fileUrl.startsWith('http')
        ? chapter.fileUrl
        : `${apiBase.replace(/\/api$/, '')}${chapter.fileUrl}`)
    : null;

  const onDocumentLoadSuccess = ({ numPages: n }) => {
    setNumPages(n);
  };
  const onDocumentLoadError = (err) => {
    // eslint-disable-next-line no-console
    console.error('PDF load error:', err);
    setPdfError(true);
  };

  if (loadingMeta) {
    return (
      <div className="dashboard-container">
        <Sidebar activeTab="reading-books" user={user} />
        <main className="dashboard-main rb-reader">
          <div className="rb-reader__loading">
            <p>{t('rb.reader.loading')}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!chapter || !fileUrl) {
    return (
      <div className="dashboard-container">
        <Sidebar activeTab="reading-books" user={user} />
        <main className="dashboard-main rb-reader">
          <div className="rb-reader__error">
            <HiOutlineLightBulb size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
            <p>{t('rb.reader.pdf_error')}</p>
            <button
              type="button"
              className="rb-reader__back"
              onClick={() => navigate('/reading-books')}
            >
              <HiArrowLeft size={16} />
              <span>{t('rb.title')}</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  const progress = numPages ? Math.round((pageNumber / numPages) * 100) : 0;

  return (
    <div className="dashboard-container">
      <Sidebar activeTab="reading-books" user={user} />
      <main className="dashboard-main rb-reader">
        <ChapterNav
          book={book}
          chapters={chapters}
          activeChapterId={chapterId}
          onSelectChapter={(cid) => { flushPenAutosave(); navigate(`/reading-books/${bookId}/${cid}?page=1`); }}
          isOpen={isNavOpen}
          onClose={() => setIsNavOpen(false)}
          bookmarks={readingState?.bookmarks || []}
          onSelectBookmark={handleSelectBookmark}
          onClearBookmark={handleClearBookmark}
          hasPrev={hasPrevChapter}
          hasNext={hasNextChapter}
          onPrevChapter={goPrevChapter}
          onNextChapter={goNextChapter}
        />

        <div className="rb-reader__main">
          <header className="rb-reader__topbar">
            <button
              type="button"
              className="rb-reader__menu-btn"
              onClick={() => setIsNavOpen(prev => !prev)}
              aria-label={t('rb.reader.menu')}
            >
              <HiMenu size={20} />
            </button>
            <button
              type="button"
              className="rb-reader__menu-btn"
              onClick={() => setIsHighlightSidebarOpen(true)}
              title="Show Highlights"
              style={{ marginLeft: 8 }}
            >
              <HiOutlineLightBulb size={20} />
            </button>
            <button
              type="button"
              className="rb-reader__back-btn"
              onClick={() => navigate('/reading-books')}
            >
              <HiArrowLeft size={16} />
              <span>{t('rb.title')}</span>
            </button>
            <div className="rb-reader__topbar-spacer" />
            <div className="rb-reader__progress">
              <span className="rb-reader__progress-text">
                {t('rb.reader.progress_label').replace('{pct}', progress)}
              </span>
              <div className="rb-reader__progress-bar">
                <div
                  className="rb-reader__progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </header>

          <ReaderToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            penColor={penColor}
            onPenColorChange={setPenColor}
            penWidth={penWidth}
            onPenWidthChange={setPenWidth}
            pressureSimEnabled={pressureSimEnabled}
            onPressureSimToggle={() => setPressureSimEnabled((v) => !v)}
            eraserType={eraserType}
            onEraserTypeChange={setEraserType}
            eraserWidth={eraserWidth}
            onEraserWidthChange={setEraserWidth}
            onClearPage={handleClearPage}
            onUndo={undo}
            onRedo={redo}
            canUndo={toolbarCanUndo}
            canRedo={toolbarCanRedo}
            onToggleBookmark={handleToggleBookmark}
            isBookmarked={isBookmarked}
            scale={scale}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            pageNumber={pageNumber}
            pageCount={numPages}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
            onPageChange={handlePageChange}
          />

          <div className="rb-reader__viewport">
            {pdfError ? (
              <div className="rb-reader__error">
                <p>{t('rb.reader.pdf_error')}</p>
              </div>
            ) : (
              <ErrorBoundary>
                <PdfCanvas
                  fileUrl={fileUrl}
                  pageNumber={pageNumber}
                  scale={scale}
                  annotations={visiblePageAnnotations}
                  highlights={highlights.filter(h => h.pageNumber === pageNumber)}
                  activeTool={activeTool}
                  penColor={penColor}
                  penWidth={penWidth}
                  pressureSimEnabled={pressureSimEnabled}
                  eraserType={eraserType}
                  eraserWidth={eraserWidth}
                  onAnnotate={handleAnnotate}
                  onAnnotationClick={handleAnnotationClick}
                  onAnnotationPartialErase={handleAnnotationPartialErase}
                  onHighlightPartialEraseEnd={handleHighlightPartialEraseEnd}
                  onAddHighlight={addHighlight}
                  onDeleteHighlight={deleteHighlight}
                  onDocumentLoad={onDocumentLoadSuccess}
                  onDocumentError={onDocumentLoadError}
                />
              </ErrorBoundary>
            )}
          </div>
        </div>

        <HighlightSidebar 
          isOpen={isHighlightSidebarOpen} 
          onClose={() => setIsHighlightSidebarOpen(false)} 
          highlights={highlights} 
          onHighlightClick={(h) => {
            // Jump to page if it's on a different page
            if (h.pageNumber !== pageNumber) {
              setPageNumber(h.pageNumber);
            }
          }}
          onDeleteHighlight={deleteHighlight}
        />
      </main>
    </div>
  );
}
