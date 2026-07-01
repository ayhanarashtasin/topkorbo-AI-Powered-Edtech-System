import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import RichTextEditor from '../components/forum/RichTextEditor';
import MentionInput from '../components/forum/MentionInput';
import forumApi from '../services/forumApi';
import { useForum } from '../context/ForumContext';

const CATEGORIES = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology',
  'General', 'Exam', 'Assignment', 'Other'
];

export default function ForumCompose() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const editId = search.get('edit');
  const { user } = useForum();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [type, setType] = useState('text');
  const [tags, setTags] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const editorRef = useRef(null);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await forumApi.getPost(editId);
        if (cancelled) return;
        setTitle(r.data.title || '');
        setCategory(r.data.category || 'General');
        setType(r.data.type || 'text');
        setTags((r.data.tags || []).join(', '));
        setContentHtml(r.data.contentHtml || '');
      } catch (e) {
        toast.error('Could not load post for editing.');
      }
    })();
    return () => { cancelled = true; };
  }, [editId]);

  // Create object URLs for the image previews and revoke them on cleanup so
  // we don't leak memory when files change or the component unmounts.
  useEffect(() => {
    const urls = imageFiles.map((f) => URL.createObjectURL(f));
    setImagePreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [imageFiles]);

  function pickImages() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,image/webp';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from(e.target.files || []).slice(0, 8 - imageFiles.length);
      setImageFiles((prev) => [...prev, ...files]);
    };
    input.click();
  }

  function removeImage(idx) {
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (!user) {
      toast.error('Please sign in to post.');
      navigate('/');
      return;
    }
    if (!contentHtml.trim() || !editorRef.current?.getText()) {
      setError('Please write something before posting.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      let result;
      if (editId) {
        result = await forumApi.updatePost(editId, {
          contentHtml, title, category, type, tags
        });
        toast.success('Post updated.');
        navigate('/forum');
      } else {
        result = await forumApi.createPost({
          contentHtml, title, category, type, tags, images: imageFiles
        });
        toast.success('Posted!');
        navigate('/forum');
      }
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="forum-composer" style={{ maxWidth: 760, margin: '0 auto' }}>
      <h2>{editId ? 'Edit post' : 'Create a new post'}</h2>

      {error && <div className="forum-error">{error}</div>}

      <div className="forum-composer__row">
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          type="text"
          placeholder="Add a title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
        <label className="toggle">
          <input
            type="checkbox"
            checked={type === 'question'}
            onChange={(e) => setType(e.target.checked ? 'question' : 'text')}
          />
          Post as question
        </label>
      </div>

      <div className="forum-composer__row">
        <input
          type="text"
          placeholder="Tags (comma separated, e.g. python, vectors, mock-test)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
      </div>

      <RichTextEditor
        ref={editorRef}
        placeholder="What would you like to share with the community?"
        onChange={setContentHtml}
        onImageFiles={(files) => setImageFiles((prev) => [...prev, ...files].slice(0, 8))}
      />
      <MentionInput containerRef={editorRef} onSelect={() => { }} />

      <div className="forum-composer__row" style={{ marginTop: 12, alignItems: 'flex-start' }}>
        <button type="button" className="forum-upload-btn" onClick={pickImages}>
          Attach images
        </button>
        <span className="forum-composer__hint">
          PNG, JPEG, GIF or WebP up to 5MB each. {imageFiles.length}/8 attached.
        </span>
      </div>

      {imagePreviews.length > 0 && (
        <div className="forum-image-previews">
          {imagePreviews.map((src, i) => (
            <div className="forum-image-previews__item" key={i}>
              <img src={src} alt="" />
              <button type="button" className="forum-image-previews__remove" onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
        </div>
      )}

      <div className="forum-composer__footer" style={{ marginTop: 18 }}>
        <span className="forum-composer__hint">
          Tip: type <strong>@</strong> to mention another user.
        </span>
        <button
          type="button"
          className="forum-composer__submit"
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? (editId ? 'Saving…' : 'Posting…') : (editId ? 'Save changes' : 'Publish post')}
        </button>
      </div>
    </div>
  );
}