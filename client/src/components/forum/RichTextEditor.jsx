import { useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { HiCode, HiLink } from 'react-icons/hi';
import { MdFormatBold, MdFormatItalic, MdFormatListBulleted, MdFormatQuote } from 'react-icons/md';

// RichTextEditor — controlled contentEditable wrapper.
//
// Toolbar: bold / italic / code block / blockquote / bulleted list / link.
// Pasted images are forwarded to the parent via onImageFiles (the parent
// uploads them). HTML is re-sanitized server-side with sanitize-html.
//
// No third-party editor is used to keep the bundle small.
function RichTextEditor(
  {
    ref,
    initialHtml = '',
    placeholder = 'Share something with the community…',
    onChange,
    onImageFiles,
    minHeight = 160
  }
) {
  const editorRef = useRef(null);

  // NOTE: `handleInput` must be declared before the `useImperativeHandle`
  // that captures it. Otherwise the imperative methods would reference a
  // TDZ variable and crash the compose page with a blank render.
  const handleInput = useCallback(() => {
    const html = editorRef.current?.innerHTML || '';
    const text = (editorRef.current?.innerText || '').trim();
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
      onChange && onChange('', '');
    }
  }), [handleInput, onChange]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== initialHtml) {
      editorRef.current.innerHTML = initialHtml || '';
    }
  }, [initialHtml]);

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
}

export default RichTextEditor;
