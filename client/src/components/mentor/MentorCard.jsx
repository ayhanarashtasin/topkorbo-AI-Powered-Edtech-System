import { HiAcademicCap, HiArrowRight, HiCheckCircle, HiClock, HiUserAdd } from 'react-icons/hi';
import MentorAvatar from './MentorAvatar';
import { RatingDisplay } from './RatingStars';
import { formatRating, formatReviewCount, getConnectionDetails } from './mentorPresentation';

const MAX_VISIBLE_GUIDANCE_AREAS = 3;

function StatusIcon({ tone }) {
  if (tone === 'connected') return <HiCheckCircle size={15} aria-hidden="true" />;
  if (tone === 'pending') return <HiClock size={15} aria-hidden="true" />;
  return <span className="find-mentor-status__dot" aria-hidden="true" />;
}

export default function MentorCard({ mentor, isRequesting, onOpen, onRequest }) {
  const connection = getConnectionDetails(mentor.connectionStatus);
  const guidanceAreas = mentor.interestedToGuide?.length ? mentor.interestedToGuide : ['General guidance'];
  const visibleGuidanceAreas = guidanceAreas.slice(0, MAX_VISIBLE_GUIDANCE_AREAS);
  const hiddenGuidanceAreaCount = guidanceAreas.length - visibleGuidanceAreas.length;
  const mentorName = mentor.name || 'Mentor';
  const mentorTitleId = `mentor-${mentor._id}-title`;
  const recentReview = mentor.recentReviews?.find((review) => review.comment?.trim());

  return (
    <article className="find-mentor-card" aria-labelledby={mentorTitleId}>
      <div className="find-mentor-card__topline">
        <span className={`find-mentor-status find-mentor-status--${connection.tone}`}>
          <StatusIcon tone={connection.tone} />
          {connection.statusLabel}
        </span>
        <span className="find-mentor-card__rating-summary">
          <RatingDisplay value={mentor.averageRating} />
          <strong>{mentor.averageRating ? formatRating(mentor.averageRating) : 'New'}</strong>
          <span>({formatReviewCount(mentor.reviewCount)})</span>
        </span>
      </div>

      <div className="find-mentor-card__identity">
        <MentorAvatar mentor={mentor} />
        <span className="find-mentor-card__identity-copy">
          <h3 id={mentorTitleId}>{mentorName}</h3>
          <span>{mentor.universityName || 'University details not added'}</span>
        </span>
        <button
          type="button"
          className="find-mentor-card__profile-arrow"
          onClick={() => onOpen(mentor._id, mentor)}
          aria-label={`View ${mentorName}'s profile`}
        >
          <HiArrowRight size={19} aria-hidden="true" />
        </button>
      </div>

      <div className="find-mentor-card__academic">
        <HiAcademicCap size={18} aria-hidden="true" />
        <span>{mentor.department || mentor.currentYearSemester || 'Academic mentor'}</span>
        {mentor.department && mentor.currentYearSemester ? <small>{mentor.currentYearSemester}</small> : null}
      </div>

      <p className="find-mentor-card__achievement">
        {mentor.admissionAchievement || 'Guidance for admission strategy, subject planning, and steady progress.'}
      </p>

      <div className="find-mentor-card__guidance">
        <span className="find-mentor-card__section-label">Can guide you in</span>
        <div className="find-mentor-tags" aria-label="Guidance areas">
          {visibleGuidanceAreas.map((item) => <span key={item}>{item}</span>)}
          {hiddenGuidanceAreaCount > 0 ? <span>+{hiddenGuidanceAreaCount}</span> : null}
        </div>
      </div>

      {recentReview ? (
        <blockquote className="find-mentor-card__review">
          <span>Student perspective</span>
          <p>“{recentReview.comment}”</p>
        </blockquote>
      ) : (
        <div className="find-mentor-card__review find-mentor-card__review--empty">
          <span>Student perspective</span>
          <p>Be the first connected student to share a review.</p>
        </div>
      )}

      <div className="find-mentor-card__actions">
        <button type="button" className="find-mentor-button find-mentor-button--secondary" onClick={() => onOpen(mentor._id, mentor)}>
          View profile
        </button>
        <button
          type="button"
          className="find-mentor-button find-mentor-button--primary"
          disabled={!connection.canRequest || isRequesting}
          aria-busy={isRequesting}
          onClick={() => onRequest(mentor._id)}
        >
          <HiUserAdd size={17} aria-hidden="true" />
          {isRequesting ? 'Sending…' : connection.actionLabel}
        </button>
      </div>
    </article>
  );
}
