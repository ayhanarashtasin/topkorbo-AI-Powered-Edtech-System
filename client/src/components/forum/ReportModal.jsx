import { useState } from 'react';
import toast from 'react-hot-toast';
import forumApi from '../../services/forumApi';

const REASONS = [
  { value: 'spam', label: 'Spam or self-promotion' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'nudity', label: 'Nudity or sexual content' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'cheating', label: 'Cheating or exam malpractice' },
  { value: 'other', label: 'Something else' }
];

export default function ReportModal({ targetType, target, open, onClose }) {
  const [reason, setReason] = useState('spam');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function submit() {
    setSubmitting(true);
    try {
      await forumApi.report({ targetType, target, reason, description });
      toast.success('Report submitted. Our moderators will review it shortly.');
      onClose && onClose();
    } catch (e) {
      toast.error(e.message || 'Could not submit report.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="forum-modal-backdrop" onClick={onClose}>
      <div className="forum-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>Report this {targetType}</h3>
        <p className="forum-muted" style={{ marginTop: -4, marginBottom: 14, fontSize: '0.88rem' }}>
          We only show reports to our moderation team.
        </p>
        <div className="forum-modal__field">
          <label htmlFor="reason">Reason</label>
          <select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="forum-modal__field">
          <label htmlFor="desc">Details (optional)</label>
          <textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any context that might help our moderators…"
            maxLength={1000}
          />
        </div>
        <div className="forum-modal__actions">
          <button type="button" className="forum-btn" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="forum-btn forum-btn--danger"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? 'Sending…' : 'Submit report'}
          </button>
        </div>
      </div>
    </div>
  );
}