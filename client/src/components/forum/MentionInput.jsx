import { useEffect, useRef, useState } from 'react';
import forumApi from '../../services/forumApi';
import UserAvatar from './UserAvatar';
import useDebounce from '../../hooks/useDebounce';

/**
 * MentionInput — wraps a contentEditable element with @-mention autocomplete.
 * The parent renders an editable surface and we provide an `attachTo(ref)` API.
 * On selection, we replace the `@partial` token with a sanitized
 *   <a class="mention" data-uid="..." href="/forum/u/...">@username</a>
 *
 * For simplicity, we manage a hidden contenteditable attached to `ref.current`.
 * We add an input event listener that detects the current `@token` being typed.
 */
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

  // Detect @token while the user types in the attached editable
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

  // Search users when query changes
  useEffect(() => {
    if (!active) return;
    if (debounced.length < minChars) {
      setResults([]);
      return;
    }
    let cancelled = false;
    forumApi
      .search(debounced, 'user')
      .then((r) => {
        if (!cancelled) setResults(r.data?.users || []);
        setHighlight(0);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, active, minChars]);

  function choose(user) {
    if (!containerRef?.current) return;
    const range = lastRange.current;
    if (range) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    // Find the @token in the text and replace it
    const node = range?.startContainer;
    if (node && node.nodeType === Node.TEXT_NODE) {
      const offset = range.startOffset;
      const before = node.textContent.slice(0, offset);
      const after = node.textContent.slice(offset);
      const replaced = before.replace(/@([a-z0-9_.]{0,24})$/i, '');
      const username = user.username || user.name?.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const link = `<a class="mention" data-uid="${user._id}" href="/forum/u/${user._id}">@${username}</a>&nbsp;`;
      node.textContent = replaced;
      // Insert the link node after the text node
      const linkNode = document.createElement('span');
      linkNode.innerHTML = link;
      const parent = node.parentNode;
      while (linkNode.firstChild) parent.insertBefore(linkNode.firstChild, node.nextSibling);
      parent.insertBefore(document.createTextNode(after), linkNode.nextSibling);
      parent.removeChild(node);
    }
    setActive(false);
    onSelect && onSelect(user);
  }

  // Position popup near the caret
  const [popupPos, setPopupPos] = useState(null);
  useEffect(() => {
    if (!active || !lastRange.current) return;
    const r = lastRange.current.getBoundingClientRect();
    setPopupPos({
      top: r.bottom + window.scrollY + 6,
      left: r.left + window.scrollX
    });
  }, [active, query]);

  if (!active || !results.length) return null;

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