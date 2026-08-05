/**
 * MentionInput Component - @-mention autocomplete for contentEditable elements.
 * 
 * WHY: Forum posts need a smooth mention experience that works with rich text editors.
 * This component attaches to a contentEditable container and provides real-time
 * autocomplete suggestions when users type @mentions.
 * 
 * HOW IT WORKS:
 * 1. Input Detection: Monitors keyboard input to detect when user types @ followed by characters
 * 2. Search: Debounces the search query and fetches matching users from the API
 * 3. Popup Positioning: Dynamically positions the suggestion popup below the caret
 * 4. Selection: Replaces the @token with a structured mention link in the editor
 * 
 * The component handles both structured mentions (from previous edits) and plain text
 * mentions, ensuring consistent behavior across different editor states.
 */

import { useEffect, useRef, useState } from 'react';
import forumApi from '../../services/forumApi';
import UserAvatar from './UserAvatar';
import useDebounce from '../../hooks/useDebounce';

export default function MentionInput({
  containerRef,  // Ref to the contentEditable container
  onSelect,      // Callback when a user is selected: (user) => void
  minChars = 1   // Minimum characters before triggering search
}) {
  const [query, setQuery] = useState('');           // Current @token being typed
  const [active, setActive] = useState(false);      // Whether mention popup is active
  const [results, setResults] = useState([]);       // Search results from API
  const [highlight, setHighlight] = useState(0);    // Currently highlighted result index
  const debounced = useDebounce(query, 180);        // Debounced query to reduce API calls
  const popupRef = useRef(null);                    // Ref for popup positioning
  const lastRange = useRef(null);                   // Saved Range for text replacement

  /**
   * Detect the @token currently being typed in the attached editable.
   * 
   * WHY: We need to extract the partial @username being typed to search for
   * matching users. This effect listens to input/keyup events and parses the
   * text content before the caret to find the @token.
   * 
   * The detection uses a regex that matches:
   * - @ followed by 0-24 alphanumeric/underscore/dot characters
   * - Must be at start of text or preceded by whitespace
   * - This prevents matching email addresses or other @ symbols
   */
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
      // Only handle selections within our container
      if (!el.contains(range.commonAncestorContainer)) {
        setActive(false);
        return;
      }
      
      // Walk backwards from caret to find @token
      const node = range.startContainer;
      const offset = range.startOffset;
      
      // Only handle text nodes (not elements)
      if (node.nodeType !== Node.TEXT_NODE) {
        setActive(false);
        return;
      }
      
      // Extract text before caret and search for @token
      const text = node.textContent.slice(0, offset);
      const match = /(?:^|\s)@([a-z0-9_.]{0,24})$/i.exec(text);
      
      if (!match) {
        setActive(false);
        return;
      }
      
      // Save the range for later replacement and update query
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

  /**
   * Search users whenever the debounced query changes.
   * 
   * WHY: We need to fetch matching users from the API as the user types.
   * The debounce prevents excessive API calls while maintaining responsiveness.
   * 
   * The search is cancelled if:
   * - The component becomes inactive (user moved cursor away)
   * - Query is shorter than minChars
   * - Component unmounts before API responds
   */
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
          setHighlight(0);  // Reset highlight to first result
        }
      })
      .catch(() => {
        if (!cancelled) setResults([]);  // Clear results on error
      });
    
    return () => {
      cancelled = true;  // Prevent state updates after unmount
    };
  }, [debounced, active, minChars]);

  /**
   * Replace the @token with a structured mention link.
   * 
   * WHY: When a user selects a mention, we need to replace the plain text @token
   * with a structured <a> tag that contains the user's ID and proper styling.
   * This ensures mentions are preserved when the content is saved and re-rendered.
   * 
   * The replacement process:
   * 1. Find the @token text node and offset
   * 2. Create a range covering the token
   * 3. Delete the token and insert the structured mention
   * 4. Move cursor after the mention with a space
   */
  function choose(user) {
    const editor = containerRef?.current?.node || containerRef?.current;
    if (!editor) return;
    
    const range = lastRange.current;
    const node = range?.startContainer;
    
    // Validate the range is still valid (node wasn't removed)
    if (range && node?.isConnected && node.nodeType === Node.TEXT_NODE) {
      const offset = range.startOffset;
      const before = node.textContent.slice(0, offset);
      
      // Re-extract the token to ensure we have the full match
      const token = /@([a-z0-9_.]{0,24})$/i.exec(before);
      if (!token) return;

      // Create the structured mention element
      const username = user.username || user.name?.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const mention = document.createElement('a');
      mention.className = 'mention';
      mention.dataset.uid = user._id;
      mention.href = `/forum/u/${user._id}`;
      mention.textContent = `@${username}`;
      
      // Add a space after the mention for better readability
      const spacer = document.createTextNode('\u00a0');

      // Create a range covering the @token to be replaced
      const replacement = document.createRange();
      replacement.setStart(node, offset - token[0].length);
      replacement.setEnd(node, offset);
      replacement.deleteContents();  // Remove the @token

      // Insert the structured mention and spacer
      const fragment = document.createDocumentFragment();
      fragment.append(mention, spacer);
      replacement.insertNode(fragment);

      // Move cursor after the mention
      const selection = window.getSelection();
      replacement.setStartAfter(spacer);
      replacement.collapse(true);
      selection.removeAllRanges();
      selection.addRange(replacement);
      
      // Trigger input event so the editor registers the change
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    setActive(false);
    onSelect && onSelect(user);
  }

  /**
   * Position the suggestion popup just below the caret.
   * 
   * WHY: The popup needs to appear near where the user is typing for
   * intuitive interaction. We calculate position based on the saved range's
   * bounding rectangle, accounting for page scroll.
   */
  const [popupPos, setPopupPos] = useState(null);
  useEffect(() => {
    if (!active || !lastRange.current) return;
    
    const r = lastRange.current.getBoundingClientRect();
    setPopupPos({
      top: r.bottom + window.scrollY + 6,  // 6px gap below caret
      left: r.left + window.scrollX
    });
  }, [active, query]);

  // Don't render if not active, query too short, or no results
  if (!active || debounced.length < minChars || !results.length) return null;

  return (
    <div
      ref={popupRef}
      className="forum-mention-popup"
      style={popupPos ? { top: popupPos.top, left: popupPos.left } : undefined}
      role="listbox"
    >
      {/* Show top 6 results for performance */}
      {results.slice(0, 6).map((u, idx) => (
        <div
          key={u._id}
          className={`forum-mention-item ${idx === highlight ? 'forum-mention-item--active' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();  // Prevent blur before selection
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