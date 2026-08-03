import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { useDebouncedAutoSave } from '../hooks/useDebouncedAutoSave';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useAnnotationAutosave } from '../hooks/useAnnotationAutosave';
import { annotationApi } from '../services/annotationApi';
import Sidebar from '../components/layout/Sidebar';
import ChapterNav from '../components/reader/ChapterNav';
import ReaderHeader from '../components/reader/ReaderHeader';
import ReaderToolbar from '../components/reader/ReaderToolbar';
import PdfCanvas from '../components/reader/PdfCanvas';
import HighlightSidebar from '../components/reader/HighlightSidebar';
import ChatSidebar from '../components/reader/ChatSidebar';
import MindMapModal from '../components/reader/MindMapModal';
import bookApi from '../services/bookApi';
import { useHighlights } from '../hooks/useHighlights';
import { useChat } from '../hooks/useChat';
import { usePlan } from '../hooks/usePlan';
import ErrorBoundary from '../components/layout/ErrorBoundary';
import {
  HiArrowLeft,
  HiOutlineLightBulb
} from 'react-icons/hi';
import toast from 'react-hot-toast';
import './ReadingBookView.css';
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;

function strokeIdentity(stroke) {
  if (stroke?.clientId) return stroke.clientId;
  if (stroke?._id) return `legacy:${stroke._id}`;
  return null;
}

function withStableClientId(stroke) {
  const clientId = strokeIdentity(stroke);
  return clientId ? { ...stroke, clientId } : stroke;
}

function makeClientId() {
  if (globalThis.crypto?.randomUUID) return `c-${globalThis.crypto.randomUUID()}`;
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
  const [scale, setScale] = useState(() => (
    typeof window !== 'undefined' && window.innerWidth <= 600 ? 0.58 : 1.1
  ));
  const [activeTool, setActiveTool] = useState('select');
  const [penColor, setPenColor] = useState('#EF4444');
  const [penWidth, setPenWidth] = useState(3);
  const [pressureSimEnabled, setPressureSimEnabled] = useState(true);
  const [allAnnotations, setAllAnnotations] = useState([]);
  const [annotationPageKey, setAnnotationPageKey] = useState('');
  const [readingState, setReadingState] = useState(null);
  const [isNavOpen, setIsNavOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [isHighlightSidebarOpen, setIsHighlightSidebarOpen] = useState(false);
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);
  const [knowledgeLoading, setKnowledgeLoading] = useState(true);
  const [knowledgeStatus, setKnowledgeStatus] = useState('pending');
  const [knowledgeTree, setKnowledgeTree] = useState(null);
  const [isMindMapOpen, setIsMindMapOpen] = useState(false);
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

  // Reading tools (pen/highlighter/notes) and reading AI (tutor chat / mind-map)
  // are Pro+ features. Enforcement is server-side; this only hides the UI.
  const { canReadingTools, canReadingAI } = usePlan();

  const { highlights, addHighlight, deleteHighlight, updateHighlight } = useHighlights({ bookId, chapterId, apiBase });
  const chat = useChat({
    bookId,
    chapterId: chapterId,
    topicId: '',
    nodeId: '',
    pageNumber,
    scope: tutorScope,
    enabled: isChatSidebarOpen && canReadingAI,
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
  const history = useUndoRedo({ limit: 200, keyboard: false });
  const resetHistory = history.reset;
  const currentAnnotationPageKey = `${chapterId}:${pageNumber}`;

  // Server-fetched annotations for the current page (non-pen ones plus
// committed pen strokes already on the server).
  const pageAnnotations = useMemo(
    () => allAnnotations.filter((a) => Number(a.pageNumber) === Number(pageNumber)),
    [allAnnotations, pageNumber]
  );

  // Merge in-memory undoable pen strokes with the server-fetched list
// so the canvas sees one unified set of annotations.
  const visiblePageAnnotations = useMemo(() => {
    if (annotationPageKey !== currentAnnotationPageKey) return [];
    const pen = history.present;
    const others = pageAnnotations.filter((a) => a.type !== 'pen');
    return [...others, ...pen];
  }, [annotationPageKey, currentAnnotationPageKey, history.present, pageAnnotations]);

  // Autosave bulk-POSTs queued pen strokes every ~5s. `onSaved` is invoked
// with the server-returned documents; we use those to swap each
// optimistic `local-...` ID for the real server `_id` so future erases
// and bulk deletes can address them. The local stroke itself is kept
// in `history.present`, which is what the canvas renders from.
  const autosave = useAnnotationAutosave({
    bookId,
    chapterId,
    pageNumber,
    delay: 5000,
    onSaved: (inserted) => {
      const byClientId = new Map(inserted.map((stroke) => [stroke.clientId, stroke]));
      const reconcile = (local) => {
        const saved = byClientId.get(strokeIdentity(local));
        return saved ? { ...local, ...saved, clientId: saved.clientId } : local;
      };
      setAllAnnotations((prev) => prev.map(reconcile));
      history.setPresent((prev) => prev.map(reconcile));
    },
    onError: (err) => {
      console.error('Annotation autosave failed:', err);
      toast.error(t('rb.reader.error.save') || 'Failed to save annotations');
    }
  });

  // Fetch only the active page. The response itself is a reset boundary, so
  // delayed network data is rendered immediately instead of waiting for a
  // later page change. Restored pagehide operations are merged by clientId.
  useEffect(() => {
    if (!chapterId || !pageNumber) return undefined;
    let cancelled = false;
    const loadPageAnnotations = async () => {
      try {
        const data = await annotationApi.list(chapterId, pageNumber);
        if (cancelled) return;
        const serverPens = (data?.annotations || [])
          .filter((annotation) => annotation.type === 'pen')
          .map(withStableClientId);
        const byClientId = new Map(serverPens.map((stroke) => [stroke.clientId, stroke]));
        for (const restored of autosave.restoredStrokes) {
          if (!byClientId.has(restored.clientId)) byClientId.set(restored.clientId, restored);
        }
        const merged = Array.from(byClientId.values());
        setAllAnnotations(merged);
        resetHistory(merged);
        setAnnotationPageKey(`${chapterId}:${pageNumber}`);
      } catch (err) {
        if (cancelled) return;
        console.error('Error loading annotations:', err);
        setAllAnnotations([]);
        resetHistory(autosave.restoredStrokes);
        setAnnotationPageKey(`${chapterId}:${pageNumber}`);
      }
    };
    loadPageAnnotations();
    return () => { cancelled = true; };
  }, [autosave.restoredStrokes, chapterId, pageNumber, resetHistory]);

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
    if (!bookId || !canReadingAI) {
      return undefined;
    }
    let cancelled = false;
    let pollTimer = null;

    const loadKnowledge = async () => {
      try {
        setKnowledgeLoading(true);
        const data = await bookApi.getKnowledge(bookId);
        if (cancelled || !data) return;
        setKnowledgeStatus(data.status || 'pending');
        if (data.tree) setKnowledgeTree(data.tree);
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
  }, [bookId, canReadingAI]);

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
  const { save: saveReadingState } = useDebouncedAutoSave(async (nextPage) => {
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

  const handleAnnotate = useCallback((payload) => {
    if (payload.type !== 'pen') return;
    const clientId = makeClientId();
    const newStroke = {
      _id: `local-${clientId}`,
      clientId,
      pageNumber,
      type: 'pen',
      color: payload.color,
      strokeWidth: payload.strokeWidth,
      referenceWidth: payload.referenceWidth,
      points: payload.points
    };
    history.push({
      label: 'draw',
      stroke: newStroke,
      do: (state) => state.some((item) => strokeIdentity(item) === clientId) ? state : [...state, newStroke],
      undo: (state) => state.filter((item) => strokeIdentity(item) !== clientId)
    });
    autosave.enqueue(newStroke);
  }, [autosave, history, pageNumber]);

  const handleAnnotationEraseBatch = useCallback((items) => {
    if (activeTool !== 'eraser') return;
    const strokes = (Array.isArray(items) ? items : [items]).filter(Boolean);
    if (strokes.length === 0) return;
    const ids = new Set(strokes.map(strokeIdentity).filter(Boolean));
    history.push({
      label: 'erase',
      strokes,
      do: (state) => state.filter((stroke) => !ids.has(strokeIdentity(stroke))),
      undo: (state) => {
        const presentIds = new Set(state.map(strokeIdentity));
        return [...state, ...strokes.filter((stroke) => !presentIds.has(strokeIdentity(stroke)))];
      }
    });
    strokes.forEach(autosave.remove);
  }, [activeTool, autosave, history]);

  const handleAnnotationClick = useCallback((item) => {
    handleAnnotationEraseBatch([item]);
  }, [handleAnnotationEraseBatch]);

  const handleAnnotationPartialEraseBatch = useCallback((modifications) => {
    const valid = (Array.isArray(modifications) ? modifications : []).filter(
      (entry) => entry?.originalStroke && Array.isArray(entry.newSegments)
    );
    if (valid.length === 0) return;

    const originals = valid.map((entry) => withStableClientId(entry.originalStroke));
    const originalIds = new Set(originals.map(strokeIdentity));
    const segments = valid.flatMap((entry) => entry.newSegments.map((points) => {
      const clientId = makeClientId();
      return {
        _id: `local-${clientId}`,
        clientId,
        pageNumber,
        type: 'pen',
        color: entry.originalStroke.color,
        strokeWidth: entry.originalStroke.strokeWidth,
        referenceWidth: entry.originalStroke.referenceWidth,
        points
      };
    }));
    const segmentIds = new Set(segments.map(strokeIdentity));
    const action = {
      label: 'partial-erase',
      originals,
      segments,
      do: (state) => [...state.filter((stroke) => !originalIds.has(strokeIdentity(stroke))), ...segments],
      undo: (state) => [...state.filter((stroke) => !segmentIds.has(strokeIdentity(stroke))), ...originals]
    };
    history.push(action);
    originals.forEach(autosave.remove);
    segments.forEach(autosave.enqueue);
  }, [autosave, history, pageNumber]);

  const handleAnnotationPartialErase = useCallback((originalStroke, newSegments) => {
    handleAnnotationPartialEraseBatch([{ originalStroke, newSegments }]);
  }, [handleAnnotationPartialEraseBatch]);

  const handleHighlightPartialEraseEnd = useCallback(async (modifications) => {
    // Apply batched highlight modifications: empty rects mean delete.
    const operations = Object.entries(modifications).map(([id, newRects]) => {
      if (newRects.length === 0) {
        return deleteHighlight(id);
      }
      return updateHighlight(id, { rects: newRects });
    });
    await Promise.allSettled(operations);
  }, [deleteHighlight, updateHighlight]);

  const handleClearPage = useCallback(() => {
    const strokes = [...history.present];
    if (strokes.length === 0) return;
    history.push({
      label: 'clear-page',
      strokes,
      do: () => [],
      undo: () => strokes
    });
    strokes.forEach(autosave.remove);
    toast.success(t('rb.reader.clear_success') || 'Page cleared');
  }, [autosave, history, t]);

  const syncHistoryAction = useCallback((action, direction) => {
    if (!action) return;
    const isUndo = direction === 'undo';
    if (action.label === 'draw') {
      (isUndo ? autosave.remove : autosave.enqueue)(action.stroke);
    } else if (action.label === 'erase' || action.label === 'clear-page') {
      action.strokes.forEach(isUndo ? autosave.enqueue : autosave.remove);
    } else if (action.label === 'partial-erase') {
      action.originals.forEach(isUndo ? autosave.enqueue : autosave.remove);
      action.segments.forEach(isUndo ? autosave.remove : autosave.enqueue);
    }
  }, [autosave]);

  // Undo / redo wrappers that also kick the autosave scheduler so the
// canvas and the server stay in sync.
  const undo = useCallback(() => {
    syncHistoryAction(history.undo(), 'undo');
  }, [history, syncHistoryAction]);

  const redo = useCallback(() => {
    syncHistoryAction(history.redo(), 'redo');
  }, [history, syncHistoryAction]);

  useEffect(() => {
    const isEditable = (element) => element && (
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable
    );
    const onKeyDown = (event) => {
      if (event.defaultPrevented || isEditable(event.target) || !(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  const toolbarCanUndo = history.canUndo;
  const toolbarCanRedo = history.canRedo;

  // Index of the active chapter in the chapter list — drives prev/next buttons.
  const currentChapterIndex = useMemo(
    () => chapters.findIndex((c) => String(c._id) === String(chapterId)),
    [chapters, chapterId]
  );
  const hasPrevChapter = currentChapterIndex > 0;
  const hasNextChapter = currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1;

  const goPrevChapter = async () => {
    if (!hasPrevChapter) return;
    await flushPenAutosave();
    const prev = chapters[currentChapterIndex - 1];
    navigate(`/reading-books/${bookId}/${prev._id}?page=1`);
  };
  const goNextChapter = async () => {
    if (!hasNextChapter) return;
    await flushPenAutosave();
    const next = chapters[currentChapterIndex + 1];
    navigate(`/reading-books/${bookId}/${next._id}?page=1`);
  };

  const handleSelectChapter = useCallback(async (cid) => {
    await flushPenAutosave();
    setTutorScope('page');
    navigate(`/reading-books/${bookId}/${cid}?page=1`);
  }, [bookId, flushPenAutosave, navigate]);

  const handleAskBookAI = useCallback(() => {
    setTutorScope('book');
    setIsChatSidebarOpen(true);
  }, []);

  const handleOpenMindMap = useCallback(() => {
    if (!canReadingAI) {
      toast.error('Mind map is a Pro+ feature.');
      navigate('/pricing');
      return;
    }
    setIsMindMapOpen(true);
  }, [canReadingAI, navigate]);

  // Jump to a node picked in the mind map. Nodes carry the chapter they
  // belong to; if it's a different chapter we navigate to its route, otherwise
  // we just move within the current chapter's PDF.
  const handleMindMapJump = useCallback(async ({ chapterId: targetChapterId, page }) => {
    const nextPage = Number(page) || 1;
    if (targetChapterId && String(targetChapterId) !== String(chapterId)) {
      await flushPenAutosave();
      navigate(`/reading-books/${bookId}/${targetChapterId}?page=${nextPage}`);
      return;
    }
    await flushPenAutosave();
    setPageNumber(nextPage);
  }, [bookId, chapterId, flushPenAutosave, navigate]);

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
  const handlePrevPage = useCallback(async () => {
    await flushPenAutosave();
    setPageNumber((p) => Math.max(1, p - 1));
  }, [flushPenAutosave]);

  const handleNextPage = useCallback(async () => {
    await flushPenAutosave();
    setPageNumber((p) => Math.min(numPages || p, p + 1));
  }, [flushPenAutosave, numPages]);

  const handlePageChange = useCallback(async (newPage) => {
    await flushPenAutosave();
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

  const handleSelectBookmark = async (bm) => {
    await flushPenAutosave();
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
          <div className="rb-reader__loading" role="status" aria-live="polite">
            <span className="rb-reader__loading-book" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <strong>Opening Your Reading Room…</strong>
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
          <div className="rb-reader__error" role="alert">
            <span className="rb-reader__state-icon" aria-hidden="true">
              <HiOutlineLightBulb size={28} />
            </span>
            <strong>This Chapter Couldn’t Open</strong>
            <p>{t('rb.reader.pdf_error')} Return to the library and choose another chapter.</p>
            <Link className="rb-reader__back" to="/reading-books">
              <HiArrowLeft size={16} aria-hidden="true" />
              <span>{t('rb.title')}</span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const progress = numPages ? Math.round((pageNumber / numPages) * 100) : 0;
  const bookMeta = [
    book?.subject,
    book?.paper && book.paper !== 'N/A' ? book.paper : ''
  ].filter(Boolean).join(' / ');

  return (
    <div className="dashboard-container">
      <Sidebar activeTab="reading-books" user={user} />
      <main
        className="dashboard-main rb-reader"
        style={{ '--rb-chat-width': isChatSidebarOpen ? '380px' : '0px' }}
      >
        <a className="rb-reader__skip-link" href="#reader-document">
          Skip to Document
        </a>
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
          onOpenMindMap={handleOpenMindMap}
          canReadingAI={canReadingAI}
          knowledgeStatus={knowledgeStatus}
        />

        <div className="rb-reader__main">
          <ReaderHeader>
            <ReaderHeader.Navigation
              isOpen={isNavOpen}
              onToggle={() => setIsNavOpen((open) => !open)}
              backLabel={t('rb.title')}
            />
            <ReaderHeader.Context
              bookTitle={book?.title}
              chapterTitle={chapter?.title}
              bookMeta={bookMeta}
            />
            <ReaderHeader.Progress
              pageNumber={pageNumber}
              pageCount={numPages}
              progress={progress}
            />
          </ReaderHeader>

          {canReadingAI && (knowledgeLoading || knowledgeStatus !== 'completed') ? (
            <div className="rb-reader__knowledge-banner" role="status" aria-live="polite">
              <span className="rb-reader__knowledge-icon" aria-hidden="true">
                <HiOutlineLightBulb size={17} />
              </span>
              <div>
                <strong>
                  {knowledgeStatus === 'failed' ? 'AI Tutor Is Still Warming Up' : 'AI Is Preparing This Book'}
                </strong>
                <span>
                  {knowledgeStatus === 'failed'
                    ? 'The tutor is not ready yet, but you can still read the PDF.'
                    : 'Keep reading while the AI finishes preparing answers.'}
                </span>
              </div>
            </div>
          ) : null}

          <ReaderToolbar
            canAnnotate={canReadingTools}
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

          <section
            id="reader-document"
            className="rb-reader__viewport"
            aria-label={(chapter?.title || 'Chapter') + ' document'}
            tabIndex={-1}
          >
            {pdfError ? (
              <div className="rb-reader__error" role="alert">
                <span className="rb-reader__state-icon" aria-hidden="true">
                  <HiOutlineLightBulb size={28} />
                </span>
                <strong>The PDF Couldn’t Load</strong>
                <p>{t('rb.reader.pdf_error')} Check your connection, then reopen this chapter.</p>
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
                  onAnnotationEraseBatch={handleAnnotationEraseBatch}
                  onAnnotationPartialErase={handleAnnotationPartialErase}
                  onAnnotationPartialEraseBatch={handleAnnotationPartialEraseBatch}
                  onHighlightPartialEraseEnd={handleHighlightPartialEraseEnd}
                  onAddHighlight={addHighlight}
                  onDeleteHighlight={deleteHighlight}
                  onDocumentLoad={onDocumentLoadSuccess}
                  onDocumentError={onDocumentLoadError}
                  onPageTextReady={handlePageTextReady}
                  onSummarizeSelection={canReadingAI ? handleAskHighlightAI : undefined}
                  canAnnotate={canReadingTools}
                />
              </ErrorBoundary>
            )}
          </section>
        </div>

        <HighlightSidebar
          isOpen={isHighlightSidebarOpen}
          onClose={() => setIsHighlightSidebarOpen(false)}
          highlights={highlights}
          onHighlightClick={async (h) => {
            // Jump to the highlight's page if it's not the current one.
            if (h.pageNumber !== pageNumber) {
              await flushPenAutosave();
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
          onSourceClick={async (targetPage) => {
            if (Number.isFinite(Number(targetPage)) && Number(targetPage) >= 1) {
              await flushPenAutosave();
              setPageNumber(Number(targetPage));
            }
          }}
        />
        <MindMapModal
          isOpen={isMindMapOpen}
          onClose={() => setIsMindMapOpen(false)}
          rootNode={knowledgeTree}
          status={knowledgeStatus}
          loading={canReadingAI && knowledgeLoading}
          onJumpTo={handleMindMapJump}
        />
      </main>
    </div>
  );
}
