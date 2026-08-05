import { useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { HiCode, HiLink } from 'react-icons/hi';
import { MdFormatBold, MdFormatItalic, MdFormatListBulleted, MdFormatQuote } from 'react-icons/md';

// RichTextEditor — lightweight contentEditable wrapper for forum composition.
// Provides toolbar formatting (bold, italic, code block, blockquote, list, link)
// and clipboard image forwarding without bundling a full editor library.
// Server-side sanitization is required before rendering user content.
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

  // Must be declared before useImperativeHandle to avoid TDZ reference errors.
  const handleInput = useCallback(() => {
    const html = editorRef.current?.innerHTML || '';
    const text = (editorRef.current?.innerText || '').trim();
    onChange && onChange(html, text);
  }, [onChange]);

  // Expose imperative methods for parent components to interact with the editor
  // without direct DOM access (focus, insert HTML, get text, clear content).
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

  // Sync initial HTML from props when it changes externally (e.g., reset after submit).
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== initialHtml) {
      editorRef.current.innerHTML = initialHtml || '';
    }
  }, [initialHtml]);

  // Wrapper around document.execCommand that triggers input callback and refocuses.
  function exec(cmd, value = null) {
    document.execCommand(cmd, false, value);
    handleInput();
    editorRef.current && editorRef.current.focus();
  }

  // Prompt user for URL and create hyperlink at current selection.
  function insertLink() {
    const url = window.prompt('Link URL (https://…)');
    if (!url) return;
    exec('createLink', url);
  }

  // Intercept paste events to extract images and forward them to parent for upload.
  // Non-image paste content is handled normally by contentEditable.
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
