import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { HiCode, HiLink } from 'react-icons/hi';
import { MdFormatBold, MdFormatItalic, MdFormatListBulleted, MdFormatQuote } from 'react-icons/md';

/**
 * RichTextEditor — a controlled contentEditable wrapper.
 * - Toolbar: bold / italic / inline code / blockquote / link / lists
 * - Paste images → upload via forumApi /uploads ... or use parent onImagePaste
 * - Emits sanitized HTML via onChange(html).
 * - Exposes .focus() and .getText() through ref.
 *
 * NOTE: We're intentionally NOT using a third-party editor to keep the
 * bundle small. The content is sanitized again on the server with sanitize-html.
 */
const RichTextEditor = forwardRef(function RichTextEditor(
  {
    initialHtml = '',
    placeholder = 'Share something with the community…',
    onChange,
    onImageFiles,
    minHeight = 160
  },
  ref
) {
  const editorRef = useRef(null);
  const [empty, setEmpty] = useState(!initialHtml);

  // NOTE: define handleInput BEFORE useImperativeHandle so it's in scope
  // when the imperative methods run (avoids TDZ ReferenceError that
  // previously caused a blank-white crash on the compose page).
  const handleInput = useCallback(() => {
    const html = editorRef.current?.innerHTML || '';
    const text = (editorRef.current?.innerText || '').trim();
    setEmpty(!text);
    onChange && onChange(html, text);
  }, [onChange]);

  useImperativeHandle(ref, () => ({
    get node() { return editorRef.current; },
    focus: () => editorRef.current && editorRef.current.focus(),
    insertHtml: (html) => {
      if (!editorRef.current) return;
      editorRef.current.focus();
      document.execCommand('insertHTML', false, html);
      handleInput();
    },
    getText: () => (editorRef.current?.innerText || '').trim(),
    clear: () => {
      if (editorRef.current) editorRef.current.innerHTML = '';
      setEmpty(true);
      onChange && onChange('', '');
    }
  }), [handleInput, onChange]);

  useEffect(() => {
    if (editorRef.current && initialHtml && editorRef.current.innerHTML !== initialHtml) {
      editorRef.current.innerHTML = initialHtml;
      setEmpty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(cmd, value = null) {
    document.execCommand(cmd, false, value);
    handleInput();
    editorRef.current && editorRef.current.focus();
  }

  function insertLink() {
    const url = window.prompt('Link URL (https://…)');
    if (!url) return;
    exec('createLink', url);
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items || [];
    const imageFiles = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length && onImageFiles) {
      e.preventDefault();
      onImageFiles(imageFiles);
    }
  }

  return (
    <div className="forum-composer__editor">
      <div className="forum-composer__toolbar">
        <button type="button" className="forum-toolbar-btn" onClick={() => exec('bold')} title="Bold (Ctrl+B)">
          <MdFormatBold size={16} />
        </button>
        <button type="button" className="forum-toolbar-btn" onClick={() => exec('italic')} title="Italic (Ctrl+I)">
          <MdFormatItalic size={16} />
        </button>
        <button type="button" className="forum-toolbar-btn" onClick={() => exec('formatBlock', 'PRE')} title="Code block">
          <HiCode size={16} />
        </button>
        <button type="button" className="forum-toolbar-btn" onClick={() => exec('formatBlock', 'BLOCKQUOTE')} title="Quote">
          <MdFormatQuote size={16} />
        </button>
        <button type="button" className="forum-toolbar-btn" onClick={() => exec('insertUnorderedList')} title="Bulleted list">
          <MdFormatListBulleted size={16} />
        </button>
        <button type="button" className="forum-toolbar-btn" onClick={insertLink} title="Insert link">
          <HiLink size={16} />
        </button>
      </div>
      <div
        ref={editorRef}
        className="forum-composer__textarea"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={handleInput}
        onPaste={handlePaste}
        style={{ minHeight }}
      />
    </div>
  );
});

export default RichTextEditor;