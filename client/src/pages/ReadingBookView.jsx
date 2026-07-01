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
import ChatSidebar from '../components/reader/ChatSidebar';
import bookApi from '../services/bookApi';
import { useHighlights } from '../hooks/useHighlights';
import { useChat } from '../hooks/useChat';
import ErrorBoundary from '../components/layout/ErrorBoundary';
import {
  HiMenu,
  HiArrowLeft,
  HiOutlineLightBulb,
  HiOutlineChatAlt2
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
  const [allAnnotations, setAllAnnotations] = useState([]);
  const [readingState, setReadingState] = useState(null);
  const [isNavOpen, setIsNavOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [isHighlightSidebarOpen, setIsHighlightSidebarOpen] = useState(false);
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);
  const [knowledgeLoading, setKnowledgeLoading] = useState(true);
  const [knowledgeStatus, setKnowledgeStatus] = useState('pending');
  const [tutorScope, setTutorScope] = useState('page');
  // Page text is held in a ref so it doesn't re-render this view; ChatSidebar
// reads it at send time. The boolean flag below drives the chat composer's
// disabled state.
  const pageTextRef = useRef('');
  const [pageTextReady, setPageTextReady] = useState(false);
  const [eraserType, setEraserType] = useState('stroke');
  const [eraserWidth, setEraserWidth] = useState(16);

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const saveInProgressRef = useRef(false);

  const { highlights, addHighlight, deleteHighlight, updateHighlight } = useHighlights({ bookId, chapterId, apiBase });
  const chat = useChat({
    bookId,
    chapterId: chapterId,
    topicId: '',
    nodeId: '',
    pageNumber,
    scope: tutorScope,
    selectedTopicTitle: '',
    selectedChapterTitle: chapter?.title || '',
    selectedNodeTitle: ''
  });

  const handlePageTextReady = useCallback((text) => {
    pageTextRef.current = text || '';
    setPageTextReady(Boolean(text));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      pageTextRef.current = '';
      setPageTextReady(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pageNumber, chapterId]);

  // Per-page in-memory undo/redo stack for pen strokes. `history.present`
// is the current set of strokes; `history.push({do, undo})` adds an
// action; `history.reset(list)` is called on page change so each page
// starts with its own history (no cross-page undo).
  const history = useUndoRedo({ limit: 200 });

  // Server-fetched annotations for the current page (non-pen ones plus
// committed pen strokes already on the server).
  const pageAnnotations = useMemo(
    () => allAnnotations.filter((a) => Number(a.pageNumber) === Number(pageNumber)),
    [allAnnotations, pageNumber]
  );

  // Merge in-memory undoable pen strokes with the server-fetched list
// so the canvas sees one unified set of annotations.
  const visiblePageAnnotations = useMemo(() => {
    const pen = history.present;
    const others = pageAnnotations.filter((a) => a.type !== 'pen');
    return [...others, ...pen];
  }, [history.present, pageAnnotations]);

  // Reset the undo stack when the page changes so the user can't undo
// a stroke from a different page.
  useEffect(() => {
    const serverPens = pageAnnotations.filter((a) => a.type === 'pen');
    history.reset(serverPens);
    // We intentionally do NOT depend on `history.reset` identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, chapterId]);

  // Autosave bulk-POSTs queued pen strokes every ~5s. `onSaved` is invoked
// with the server-returned documents; we use those to swap each
// optimistic `local-...` ID for the real server `_id` so future erases
// and bulk deletes can address them. The local stroke itself is kept
// in `history.present`, which is what the canvas renders from.
  const autosave = useAnnotationAutosave({
    bookId,
    chapterId,
    pageNumber,
    serverStrokes: pageAnnotations.filter((a) => a.type === 'pen'),
    delay: 5000,
    onSaved: (inserted) => {
      // Swap optimistic local IDs for real server IDs in the server-fetched list.
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

      // Same ID swap, but in the in-memory history stack.
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
      console.error('Annotation autosave failed:', err);
      toast.error(t('rb.reader.error.save') || 'Failed to save annotations');
    }
  });

  // Validate the auth token and refresh the cached user profile.
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
        console.error('Error fetching user data:', err);
      }
    };
    fetchUser();
  }, [apiBase]);

  // Load everything needed to render a chapter: the chapter file, the book
// (for the chapter list), existing annotations, and reading state. The
// chapter request blocks rendering; the rest run in parallel.
  useEffect(() => {
    if (!bookId || !chapterId) return;
    let cancelled = false;
    const resetTimer = window.setTimeout(() => {
      if (cancelled) return;
      setLoadingMeta(true);
      setPdfError(false);
      setNumPages(0);
    }, 0);

    const token = localStorage.getItem('topkorbo_token');
    const headers = { Authorization: `Bearer ${token}` };

    // Chapter metadata — gates the PDF canvas so we never render without a URL.
    (async () => {
      try {
        const res = await fetch(`${apiBase}/books/${bookId}/chapters/${chapterId}`, { headers });
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.data?.chapter) {
          setChapter(data.data.chapter);
          setLoadingMeta(false);
        } else {
          throw new Error(data.message || 'Failed to load chapter');
        }
      } catch (err) {
        console.error('Error loading chapter:', err);
        if (!cancelled) {
          setPdfError(true);
          setLoadingMeta(false);
        }
        toast.error(t('rb.reader.error.load'));
      }
    })();

    // Book details — populates the chapter sidebar.
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
        console.error('Error loading book details:', err);
      }
    })();

    // Existing annotations — rendered as overlays once the canvas mounts.
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
        console.error('Error loading annotations:', err);
      }
    })();

    // Reading state — last page and bookmarks; falls back to ?page= if absent.
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
        console.error('Error loading reading state:', err);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(resetTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, chapterId, apiBase]);

  // Poll the book-level AI status while the background processor is still working.
  useEffect(() => {
    if (!bookId) return undefined;
    let cancelled = false;
    let pollTimer = null;

    const loadKnowledge = async () => {
      try {
        setKnowledgeLoading(true);
        const data = await bookApi.getKnowledge(bookId);
        if (cancelled || !data) return;
        setKnowledgeStatus(data.status || 'pending');
        if (data.status === 'completed') {
          setKnowledgeLoading(false);
          return;
        }
        setKnowledgeLoading(false);
        pollTimer = window.setTimeout(loadKnowledge, 8000);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load book knowledge:', err);
        setKnowledgeStatus('failed');
        setKnowledgeLoading(false);
        pollTimer = window.setTimeout(loadKnowledge, 12000);
      }
    };

    loadKnowledge();
    return () => {
      cancelled = true;
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [bookId]);

  // Mirror the current page in the URL so the chapter is shareable / restorable.
  useEffect(() => {
    const current = searchParams.get('page');
    if (String(pageNumber) === current) return;
    const next = new URLSearchParams(searchParams);
    next.set('page', String(pageNumber));
    setSearchParams(next, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber]);

  // Debounced autosave for the user's last-read page so reopening the book
// resumes where they left off.
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

  // Flush any pending pen autosave BEFORE updating `pageNumber` so queued
// strokes are POSTed against the old page, not the new one. The page-nav
// callbacks below rely on this ordering.
  const pageNumberRef = useRef(pageNumber);
  useEffect(() => { pageNumberRef.current = pageNumber; }, [pageNumber]);



  const flushPenAutosave = useCallback(async () => {
    try { await autosave.flush(); } catch { /* best-effort */ }
  }, [autosave]);

  // Handles a new pen stroke: assigns an optimistic local ID, pushes the
// draw action onto the undo stack, and queues it for autosave.
  const handleAnnotate = useCallback(async (payload) => {
    if (payload.type === 'pen') {
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


  }, [autosave, history, pageNumber]);

  // Eraser click on a pen stroke: optimistically remove it, push an
  // undoable erase action, and DELETE on the server. If the DELETE
  // fails, undo the local removal.
  const handleAnnotationClick = useCallback(async (item) => {
    if (activeTool !== 'eraser') return;
    if (!item) return;

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
    // Local-only strokes (not yet POSTed) don't need a server DELETE;
    // the autosave bulk endpoint will reject the dropped entry harmlessly.
    if (id.startsWith('local-')) return;

    try {
      await annotationApi.remove(id);
      setAllAnnotations((prev) => prev.filter((a) => a._id !== id));
    } catch (err) {
      // Server rejected the delete — undo the local removal.
        console.error('Failed to delete annotation:', err);
      history.undo();
      toast.error(t('rb.reader.error.network'));
    }
  }, [activeTool, history, t]);

  const handleAnnotationPartialErase = useCallback(async (originalStroke, newSegments) => {
    const originalId = originalStroke._id;
    if (!originalId) return;

    // Build optimistic segments that replace the partially-erased stroke.
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

    // Record the partial-erase as a single undoable action.
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

    // DELETE the original (server-known) stroke we're replacing.
    if (!originalId.startsWith('local-')) {
      try {
        await annotationApi.remove(originalId);
        setAllAnnotations((prev) => prev.filter((a) => a._id !== originalId));
      } catch (err) {
      console.error('Failed to delete original stroke for partial erase:', err);
      }
    }

    // Queue each new segment for autosave.
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
    // Apply batched highlight modifications: empty rects mean delete.
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
        console.error('Failed to clear page annotations from server:', err);
        toast.error(t('rb.reader.error.network'));
      }
    }
    toast.success(t('rb.reader.clear_success') || 'Page cleared');
  }, [visiblePageAnnotations, pageNumber, history, t]);

  // Undo / redo wrappers that also kick the autosave scheduler so the
// canvas and the server stay in sync.
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

  // Index of the active chapter in the chapter list — drives prev/next buttons.
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

  const handleSelectChapter = useCallback((cid) => {
    flushPenAutosave();
    setTutorScope('page');
    navigate(`/reading-books/${bookId}/${cid}?page=1`);
  }, [bookId, flushPenAutosave, navigate]);

  const handleAskBookAI = useCallback(() => {
    setTutorScope('book');
    setIsChatSidebarOpen(true);
  }, []);

  const handleAskHighlightAI = useCallback((highlight, mode = 'summary') => {
    if (!highlight) return;
    setTutorScope('page');
    setIsChatSidebarOpen(true);
    const question = mode === 'notes'
      ? 'Give good notes from this highlighted passage.'
      : 'Summarize this highlighted passage.';
    void chat.send(question, '', {
      requestedAction: mode === 'notes' ? 'notes' : 'summary',
      scopeOverride: 'page',
      focusText: highlight.text || '',
      focusLabel: highlight.note || `Page ${highlight.pageNumber || ''}`,
      focusPageNumber: highlight.pageNumber || null
    });
  }, [chat]);

  // Page navigation — always flushes pending autosave before changing
// `pageNumber` so queued strokes aren't attributed to the wrong page.
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

  // Bookmarks: toggle current page's bookmark, jump to a bookmark, or
// delete one. All bookmark changes round-trip through the API.
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
      console.error('Failed to remove bookmark:', err);
    }
  };

  const fileUrl = chapter?.fileUrl
    ? (chapter.fileUrl.startsWith('http')
        ? chapter.fileUrl
        : `${apiBase.replace(/\/api$/, '')}${chapter.fileUrl}`)
    : null;

  const pdfRequestHeaders = useMemo(() => {
    const token = localStorage.getItem('topkorbo_token');
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, []);

  const onDocumentLoadSuccess = ({ numPages: n }) => {
    setNumPages(n);
  };
  const onDocumentLoadError = (err) => {
    console.error('PDF load error:', err);
    setPdfError(true);
  };

  if (loadingMeta) {
    return (
      <div className="dashboard-container">
        <Sidebar activeTab="reading-books" user={user} />
        <main
          className="dashboard-main rb-reader"
          style={{ '--rb-chat-width': isChatSidebarOpen ? '380px' : '0px' }}
        >
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
        <main
          className="dashboard-main rb-reader"
          style={{ '--rb-chat-width': isChatSidebarOpen ? '380px' : '0px' }}
        >
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
      <main
        className="dashboard-main rb-reader"
        style={{ '--rb-chat-width': isChatSidebarOpen ? '380px' : '0px' }}
      >
        <ChapterNav
          key={`${bookId}-${chapterId}`}
          book={book}
          chapters={chapters}
          activeChapterId={chapterId}
          pageNumber={pageNumber}
          onSelectChapter={handleSelectChapter}
          onAskBookAI={handleAskBookAI}
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
              className="rb-reader__menu-btn"
              onClick={() => {
                setTutorScope('page');
                setIsChatSidebarOpen(true);
              }}
              title="Ask AI Tutor"
              style={{ marginLeft: 8 }}
            >
              <HiOutlineChatAlt2 size={20} />
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

          {(knowledgeLoading || knowledgeStatus !== 'completed') && (
            <div className="rb-reader__knowledge-banner">
              <strong>
                {knowledgeStatus === 'failed' ? 'AI tutor is still warming up' : 'AI is preparing this book'}
              </strong>
              <span>
                {knowledgeStatus === 'failed'
                  ? 'The tutor is not ready yet, but you can still read the PDF.'
                  : 'You can keep reading while the AI finishes preparing answers.'}
              </span>
            </div>
          )}

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
                  fileHeaders={pdfRequestHeaders}
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
                  onPageTextReady={handlePageTextReady}
                  onSummarizeSelection={handleAskHighlightAI}
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
            // Jump to the highlight's page if it's not the current one.
            if (h.pageNumber !== pageNumber) {
              setPageNumber(h.pageNumber);
            }
          }}
          onDeleteHighlight={deleteHighlight}
          onAskHighlightAI={handleAskHighlightAI}
        />
        <ChatSidebar
          isOpen={isChatSidebarOpen}
          onClose={() => setIsChatSidebarOpen(false)}
          messages={chat.messages}
          loading={chat.loading}
          sending={chat.sending}
          pageNumber={pageNumber}
          scope={tutorScope}
          onScopeChange={setTutorScope}
          pageTextReady={pageTextReady}
          getPageText={() => pageTextRef.current}
          onSend={chat.send}
          onClear={chat.clear}
          onSourceClick={(targetPage) => {
            if (Number.isFinite(Number(targetPage)) && Number(targetPage) >= 1) {
              setPageNumber(Number(targetPage));
            }
          }}
        />
      </main>
    </div>
  );
}
