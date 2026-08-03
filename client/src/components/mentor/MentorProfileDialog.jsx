import { useEffect, useRef } from 'react';
import { HiAcademicCap, HiCheckCircle, HiClock, HiRefresh, HiShieldCheck, HiUserAdd, HiX } from 'react-icons/hi';
import MentorAvatar from './MentorAvatar';
import { RatingDisplay, RatingInput } from './RatingStars';
import { formatRating, formatReviewCount, formatReviewDate, getConnectionDetails } from './mentorPresentation';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function StatusIcon({ tone }) {
  if (tone === 'connected') return <HiCheckCircle size={15} aria-hidden="true" />;
  if (tone === 'pending') return <HiClock size={15} aria-hidden="true" />;
  return <span className="find-mentor-status__dot" aria-hidden="true" />;
}

function ProfileLoadingState() {
  return (
    <div className="find-mentor-profile-loading" role="status">
      <span className="find-mentor-skeleton find-mentor-skeleton--avatar" />
      <div>
        <span className="find-mentor-skeleton find-mentor-skeleton--title" />
        <span className="find-mentor-skeleton find-mentor-skeleton--line" />
      </div>
      <span className="sr-only">Loading mentor profile…</span>
    </div>
  );
}

export default function MentorProfileDialog({
  mentor,
  isLoading,
  error,
  isRequesting,
  reviewDraft,
  reviewSaving,
  onClose,
  onRetry,
  onRequest,
  onReviewChange,
  onReviewSubmit
}) {
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);
  const connection = getConnectionDetails(mentor?.connectionStatus);
  const titleId = 'mentor-profile-title';
  const descriptionId = 'mentor-profile-description';

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusDialog = window.requestAnimationFrame(() => {
      const firstFocusable = panelRef.current?.querySelector(FOCUSABLE_SELECTOR);
      (firstFocusable || panelRef.current)?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusableElements = Array.from(panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR));
      if (!focusableElements.length) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusDialog);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [onClose]);

  const closeFromBackdrop = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="find-mentor-modal" onMouseDown={closeFromBackdrop}>
      <section
        ref={panelRef}
        className="find-mentor-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={mentor || error ? titleId : undefined}
        aria-label={!mentor && !error ? 'Mentor profile' : undefined}
        aria-describedby={mentor ? descriptionId : undefined}
        tabIndex={-1}
      >
        <button type="button" className="find-mentor-modal__close" onClick={onClose} aria-label="Close mentor profile">
          <HiX size={22} aria-hidden="true" />
        </button>

        {isLoading && !mentor ? <ProfileLoadingState /> : null}

        {error && !mentor ? (
          <div className="find-mentor-profile-error" role="alert">
            <strong id={titleId}>Couldn’t load this profile</strong>
            <p>{error} Check your connection, then try again.</p>
            <button type="button" className="find-mentor-button find-mentor-button--secondary" onClick={onRetry}>
              <HiRefresh size={17} aria-hidden="true" />
              Retry profile
            </button>
          </div>
        ) : null}

        {mentor ? (
          <>
            <header className="find-mentor-profile-head">
              <MentorAvatar mentor={mentor} variant="profile" />
              <div className="find-mentor-profile-head__identity">
                <span className={`find-mentor-status find-mentor-status--${connection.tone}`}>
                  <StatusIcon tone={connection.tone} />
                  {connection.statusLabel}
                </span>
                <h2 id={titleId}>{mentor.name || 'Mentor'}</h2>
                <p id={descriptionId}>
                  {mentor.universityName || 'University details not added'}
                  {mentor.department ? <span aria-hidden="true"> · </span> : null}
                  {mentor.department || null}
                </p>
                <div className="find-mentor-profile-head__rating">
                  <RatingDisplay value={mentor.averageRating} />
                  <strong>{mentor.averageRating ? formatRating(mentor.averageRating) : 'New mentor'}</strong>
                  <span>{formatReviewCount(mentor.reviewCount)} anonymous review{Number(mentor.reviewCount) === 1 ? '' : 's'}</span>
                </div>
              </div>
              <button
                type="button"
                className="find-mentor-button find-mentor-button--primary find-mentor-profile-head__action"
                disabled={!connection.canRequest || isRequesting}
                aria-busy={isRequesting}
                onClick={() => onRequest(mentor._id)}
              >
                <HiUserAdd size={17} aria-hidden="true" />
                {isRequesting ? 'Sending…' : connection.actionLabel}
              </button>
            </header>

            {error ? (
              <div className="find-mentor-inline-alert" role="alert">
                {error} The preview below may be out of date.
              </div>
            ) : null}

            <div className="find-mentor-profile-layout">
              <div className="find-mentor-profile-main">
                <section className="find-mentor-profile-section" aria-labelledby="mentor-story-title">
                  <div className="find-mentor-profile-section__heading">
                    <HiAcademicCap size={20} aria-hidden="true" />
                    <h3 id="mentor-story-title">Mentor Story</h3>
                  </div>
                  <p>{mentor.admissionAchievement || 'This mentor has not added an admission achievement yet.'}</p>
                  {mentor.currentYearSemester ? <p className="find-mentor-profile-detail">Currently in {mentor.currentYearSemester}</p> : null}
                </section>

                <section className="find-mentor-profile-section" aria-labelledby="mentor-guidance-title">
                  <div className="find-mentor-profile-section__heading">
                    <HiShieldCheck size={20} aria-hidden="true" />
                    <h3 id="mentor-guidance-title">Guidance Areas</h3>
                  </div>
                  <div className="find-mentor-tags">
                    {(mentor.interestedToGuide?.length ? mentor.interestedToGuide : ['General guidance'])
                      .map((item) => <span key={item}>{item}</span>)}
                  </div>
                </section>
              </div>

              <aside className="find-mentor-profile-reviews" aria-labelledby="mentor-reviews-title">
                <div className="find-mentor-profile-reviews__heading">
                  <div>
                    <span>Student perspective</span>
                    <h3 id="mentor-reviews-title">Anonymous Reviews</h3>
                  </div>
                  <strong>{formatReviewCount(mentor.reviewCount)}</strong>
                </div>

                {mentor.reviews?.length ? mentor.reviews.map((review) => (
                  <article key={review._id} className="find-mentor-review-row">
                    <div>
                      <RatingDisplay value={review.rating} />
                      <span>{formatReviewDate(review.createdAt)}</span>
                    </div>
                    <p>{review.comment || 'No written comment.'}</p>
                  </article>
                )) : (
                  <div className="find-mentor-reviews__empty">No reviews yet. Connected students can add the first one.</div>
                )}
              </aside>
            </div>

            <section className="find-mentor-profile-section find-mentor-profile-section--review" aria-labelledby="your-review-title">
              <div className="find-mentor-profile-section__heading">
                <HiShieldCheck size={20} aria-hidden="true" />
                <div>
                  <h3 id="your-review-title">Your Anonymous Review</h3>
                  <p>Your identity is never shown with this review.</p>
                </div>
              </div>

              {mentor.connectionStatus === 'accepted' ? (
                <form onSubmit={onReviewSubmit} className="find-mentor-review-form">
                  <RatingInput
                    value={reviewDraft.rating}
                    onChange={(rating) => onReviewChange({ ...reviewDraft, rating })}
                  />
                  <label htmlFor="mentor-review-comment">What should other students know?</label>
                  <textarea
                    id="mentor-review-comment"
                    name="mentor-review-comment"
                    value={reviewDraft.comment}
                    onChange={(event) => onReviewChange({ ...reviewDraft, comment: event.target.value.slice(0, 500) })}
                    placeholder="Share a specific, helpful experience…"
                    maxLength={500}
                    rows={5}
                    autoComplete="off"
                    aria-describedby="mentor-review-count"
                  />
                  <div className="find-mentor-review-form__footer">
                    <span id="mentor-review-count" aria-live="polite">{reviewDraft.comment.length}/500 characters</span>
                    <button type="submit" className="find-mentor-button find-mentor-button--primary" disabled={reviewSaving} aria-busy={reviewSaving}>
                      {reviewSaving ? 'Saving…' : mentor.currentUserReview ? 'Update review' : 'Submit review'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="find-mentor-reviews__empty">You can review this mentor after they accept your request.</div>
              )}
            </section>
          </>
        ) : null}
      </section>
    </div>
  );
}
