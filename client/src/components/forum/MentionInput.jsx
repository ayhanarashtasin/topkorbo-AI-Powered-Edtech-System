import { useEffect, useRef, useState } from 'react';
import forumApi from '../../services/forumApi';
import UserAvatar from './UserAvatar';
import useDebounce from '../../hooks/useDebounce';

// MentionInput — @-mention autocomplete for a contentEditable.
//
// We attach input/keyup listeners to the parent's editable surface via
// `containerRef` and watch for an `@token` being typed. On selection we
// replace the partial token with
//   <a class="mention" data-uid="..." href="/forum/u/...">@username</a>
export default function MentionInput({
  containerRef,
  onSelect, // (user) => void — parent will insert the link HTML
  minChars = 1
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(false);
  const [results, setResults] = useState([]);
  const [highlight, setHighlight] = useState(0);
  const debounced = useDebounce(query, 180);
  const popupRef = useRef(null);
  const lastRange = useRef(null);

  // Detect the `@token` currently being typed in the attached editable and
// expose it as `query` for the search effect below.
  useEffect(() => {
    const el = containerRef?.current?.node || containerRef?.current;
    if (!el || typeof el.addEventListener !== 'function') return;
    function onInput() {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) {
        setActive(false);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) {
        setActive(false);
        return;
      }
      // Walk backwards from the caret to find an '@' that begins a token
      const node = range.startContainer;
      const offset = range.startOffset;
      if (node.nodeType !== Node.TEXT_NODE) {
        setActive(false);
        return;
      }
      const text = node.textContent.slice(0, offset);
      const match = /(?:^|\s)@([a-z0-9_.]{0,24})$/i.exec(text);
      if (!match) {
        setActive(false);
        return;
      }
      lastRange.current = range.cloneRange();
      setQuery(match[1].toLowerCase());
      setActive(true);
    }
    el.addEventListener('input', onInput);
    el.addEventListener('keyup', onInput);
    return () => {
      el.removeEventListener('input', onInput);
      el.removeEventListener('keyup', onInput);
    };
  }, [containerRef]);

  // Search users whenever the debounced query changes.
  useEffect(() => {
    if (!active) return;
    if (debounced.length < minChars) {
      return;
    }
    let cancelled = false;
    forumApi
      .search(debounced, 'user')
      .then((r) => {
        if (!cancelled) {
          setResults(r.data?.users || []);
          setHighlight(0);
        }
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, active, minChars]);

  function choose(user) {
    const editor = containerRef?.current?.node || containerRef?.current;
    if (!editor) return;
    const range = lastRange.current;
    const node = range?.startContainer;
    if (range && node?.isConnected && node.nodeType === Node.TEXT_NODE) {
      const offset = range.startOffset;
      const before = node.textContent.slice(0, offset);
      const token = /@([a-z0-9_.]{0,24})$/i.exec(before);
      if (!token) return;

      const username = user.username || user.name?.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const mention = document.createElement('a');
      mention.className = 'mention';
      mention.dataset.uid = user._id;
      mention.href = `/forum/u/${user._id}`;
      mention.textContent = `@${username}`;
      const spacer = document.createTextNode('\u00a0');

      const replacement = document.createRange();
      replacement.setStart(node, offset - token[0].length);
      replacement.setEnd(node, offset);
      replacement.deleteContents();

      const fragment = document.createDocumentFragment();
      fragment.append(mention, spacer);
      replacement.insertNode(fragment);

      const selection = window.getSelection();
      replacement.setStartAfter(spacer);
      replacement.collapse(true);
      selection.removeAllRanges();
      selection.addRange(replacement);
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    setActive(false);
    onSelect && onSelect(user);
  }

  // Position the suggestion popup just below the caret.
  const [popupPos, setPopupPos] = useState(null);
  useEffect(() => {
    if (!active || !lastRange.current) return;
    const r = lastRange.current.getBoundingClientRect();
    setPopupPos({
      top: r.bottom + window.scrollY + 6,
      left: r.left + window.scrollX
    });
  }, [active, query]);

  if (!active || debounced.length < minChars || !results.length) return null;

  return (
    <div
      ref={popupRef}
      className="forum-mention-popup"
      style={popupPos ? { top: popupPos.top, left: popupPos.left } : undefined}
      role="listbox"
    >
      {results.slice(0, 6).map((u, idx) => (
        <div
          key={u._id}
          className={`forum-mention-item ${idx === highlight ? 'forum-mention-item--active' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            choose(u);
          }}
          onMouseEnter={() => setHighlight(idx)}
        >
          <UserAvatar user={u} size="sm" />
          <div>
            <div className="forum-mention-item__name">{u.name}</div>
            <div className="forum-mention-item__username">@{u.username || u.name?.toLowerCase()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
