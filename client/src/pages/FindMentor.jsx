import { useEffect, useMemo, useState } from 'react';
import { HiFilter, HiSearch, HiStar, HiUserAdd, HiX } from 'react-icons/hi';
import Sidebar from '../components/layout/Sidebar';
import { fetchMentorProfile, fetchMentors, sendMentorRequest, submitMentorReview } from '../services/mentorApi';
import './FindMentor.css';

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function RatingStars({ value = 0, interactive = false, onChange }) {
  const rounded = Math.round(Number(value) || 0);

  return (
    <div className={`mentor-stars ${interactive ? 'mentor-stars--interactive' : ''}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`${star} star`}
          disabled={!interactive}
          className={star <= rounded ? 'mentor-stars__star mentor-stars__star--filled' : 'mentor-stars__star'}
          onClick={() => interactive && onChange?.(star)}
        >
          <HiStar size={18} />
        </button>
      ))}
    </div>
  );
}

function getStatusLabel(status) {
  if (status === 'accepted') return 'Connected';
  if (status === 'pending') return 'Pending';
  if (status === 'declined') return 'Request again';
  return 'Send request';
}

export default function FindMentor() {
  const [user] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Student',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });
  const [mentors, setMentors] = useState([]);
  const [knownUniversities, setKnownUniversities] = useState([]);
  const [sort, setSort] = useState('rating');
  const [university, setUniversity] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestingMentorId, setRequestingMentorId] = useState('');
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [reviewDraft, setReviewDraft] = useState({ rating: 5, comment: '' });
  const [reviewSaving, setReviewSaving] = useState(false);

  const loadMentors = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchMentors({ sort, university });
      const nextMentors = Array.isArray(data) ? data : [];
      setMentors(nextMentors);
      setKnownUniversities((prev) => {
        const merged = new Set(prev);
        nextMentors.forEach((mentor) => {
          if (mentor.universityName) merged.add(mentor.universityName);
        });
        return Array.from(merged).sort((a, b) => a.localeCompare(b));
      });
    } catch (err) {
      setError(err.message || 'Failed to load mentors.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user.role !== 'student') {
      window.location.href = '/dashboard';
      return;
    }
    loadMentors();
  }, [sort, university]);

  const filteredMentors = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return mentors;

    return mentors.filter((mentor) => [
      mentor.name,
      mentor.universityName,
      mentor.department,
      mentor.admissionAchievement,
      ...(mentor.interestedToGuide || [])
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [mentors, search]);

  const openProfile = async (mentorId, mentorPreview = null) => {
    try {
      if (mentorPreview) {
        setSelectedMentor({
          ...mentorPreview,
          reviews: mentorPreview.recentReviews || []
        });
      } else {
        setSelectedMentor(null);
      }
      setProfileLoading(true);
      setProfileError('');
      setError('');
      const data = await fetchMentorProfile(mentorId);
      setSelectedMentor(data);
      setReviewDraft({
        rating: data?.currentUserReview?.rating || 5,
        comment: data?.currentUserReview?.comment || ''
      });
    } catch (err) {
      setProfileError(err.message || 'Failed to load mentor profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleMentorRequest = async (mentorId) => {
    try {
      setRequestingMentorId(mentorId);
      await sendMentorRequest(mentorId);
      await loadMentors();
      if (selectedMentor?._id === mentorId) {
        await openProfile(mentorId);
      }
    } catch (err) {
      window.alert(err.message || 'Failed to send mentor request.');
    } finally {
      setRequestingMentorId('');
    }
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    if (!selectedMentor?._id) return;

    try {
      setReviewSaving(true);
      await submitMentorReview(selectedMentor._id, reviewDraft);
      await Promise.all([loadMentors(), openProfile(selectedMentor._id)]);
    } catch (err) {
      window.alert(err.message || 'Failed to save review.');
    } finally {
      setReviewSaving(false);
    }
  };

  const renderMentorCard = (mentor) => {
    const status = mentor.connectionStatus || 'none';
    const canRequest = status === 'none' || status === 'declined';

    return (
      <article key={mentor._id} className="find-mentor-card">
        <button type="button" className="find-mentor-card__profile" onClick={() => openProfile(mentor._id, mentor)}>
          <div className="find-mentor-avatar">
            {mentor.avatar ? <img src={mentor.avatar} alt={mentor.name} referrerPolicy="no-referrer" /> : mentor.name.charAt(0)}
          </div>
          <div>
            <h3>{mentor.name}</h3>
            <p>{mentor.universityName || 'University not added'}</p>
          </div>
        </button>

        <div className="find-mentor-card__rating">
          <RatingStars value={mentor.averageRating} />
          <strong>{mentor.averageRating ? mentor.averageRating.toFixed(1) : 'New'}</strong>
          <span>{mentor.reviewCount} review{mentor.reviewCount === 1 ? '' : 's'}</span>
        </div>

        <p className="find-mentor-card__meta">{mentor.department || mentor.currentYearSemester || 'Academic mentor'}</p>
        <p className="find-mentor-card__bio">{mentor.admissionAchievement || 'Supports admission strategy, subject planning, and performance review.'}</p>

        <div className="find-mentor-tags">
          {(mentor.interestedToGuide || []).length ? mentor.interestedToGuide.map((item) => (
            <span key={item}>{item}</span>
          )) : <span>General guidance</span>}
        </div>

        <div className="find-mentor-reviews">
          {(mentor.recentReviews || []).length ? mentor.recentReviews.slice(0, 2).map((review) => (
            <blockquote key={review._id}>
              <RatingStars value={review.rating} />
              <p>{review.comment || 'No written comment.'}</p>
            </blockquote>
          )) : <div className="find-mentor-reviews__empty">No anonymous reviews yet.</div>}
        </div>

        <div className="find-mentor-card__actions">
          <button type="button" className="btn btn-secondary" onClick={() => openProfile(mentor._id, mentor)}>
            View profile
          </button>
          <button
            type="button"
            className={`btn ${canRequest ? 'btn-primary' : 'btn-secondary'}`}
            disabled={!canRequest || requestingMentorId === mentor._id}
            onClick={() => handleMentorRequest(mentor._id)}
          >
            <HiUserAdd size={16} />
            {requestingMentorId === mentor._id ? 'Sending...' : getStatusLabel(status)}
          </button>
        </div>
      </article>
    );
  };

  return (
    <div className="dashboard-container">
      <Sidebar activeTab="find-mentor" user={user} />
      <main className="dashboard-main">
        <div className="find-mentor-page">

          <section className="find-mentor-toolbar">
            <label className="find-mentor-search">
              <HiSearch size={18} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, subject, achievement" />
            </label>
            <label className="find-mentor-select">
              <HiFilter size={18} />
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="rating">Highest rated</option>
                <option value="newest">Newest mentors</option>
                <option value="name">Name A-Z</option>
              </select>
            </label>
            <label className="find-mentor-select">
              <span>University</span>
              <select value={university} onChange={(event) => setUniversity(event.target.value)}>
                <option value="">All universities</option>
                {knownUniversities.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
          </section>

          {error ? <div className="find-mentor-alert">{error}</div> : null}

          {loading ? (
            <div className="find-mentor-empty">Loading mentors...</div>
          ) : filteredMentors.length === 0 ? (
            <div className="find-mentor-empty">No mentors match your filters.</div>
          ) : (
            <section className="find-mentor-grid">
              {filteredMentors.map(renderMentorCard)}
            </section>
          )}

          {(selectedMentor || profileLoading) ? (
            <div className="find-mentor-modal" role="dialog" aria-modal="true">
              <div className="find-mentor-modal__panel">
                <button
                  type="button"
                  className="find-mentor-modal__close"
                  onClick={() => {
                    setSelectedMentor(null);
                    setProfileError('');
                  }}
                  aria-label="Close profile"
                >
                  <HiX size={22} />
                </button>
                {profileLoading && !selectedMentor ? (
                  <div className="find-mentor-empty">Loading profile...</div>
                ) : selectedMentor ? (
                  <>
                    {profileError ? <div className="find-mentor-alert">{profileError}</div> : null}
                    <div className="find-mentor-profile-head">
                      <div className="find-mentor-avatar find-mentor-avatar--large">
                        {selectedMentor.avatar ? <img src={selectedMentor.avatar} alt={selectedMentor.name} referrerPolicy="no-referrer" /> : selectedMentor.name.charAt(0)}
                      </div>
                      <div>
                        <h2>{selectedMentor.name}</h2>
                        <p>{selectedMentor.universityName || 'University not added'}{selectedMentor.department ? ` · ${selectedMentor.department}` : ''}</p>
                        <div className="find-mentor-card__rating">
                          <RatingStars value={selectedMentor.averageRating} />
                          <strong>{selectedMentor.averageRating ? selectedMentor.averageRating.toFixed(1) : 'New'}</strong>
                          <span>{selectedMentor.reviewCount} anonymous review{selectedMentor.reviewCount === 1 ? '' : 's'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="find-mentor-profile-section">
                      <h3>Mentor profile</h3>
                      <p>{selectedMentor.admissionAchievement || 'This mentor has not added an admission achievement yet.'}</p>
                      <div className="find-mentor-tags">
                        {(selectedMentor.interestedToGuide || []).map((item) => <span key={item}>{item}</span>)}
                      </div>
                    </div>

                    <div className="find-mentor-profile-section">
                      <h3>Anonymous reviews</h3>
                      {(selectedMentor.reviews || []).length === 0 ? (
                        <div className="find-mentor-reviews__empty">No reviews yet.</div>
                      ) : selectedMentor.reviews.map((review) => (
                        <article key={review._id} className="find-mentor-review-row">
                          <div>
                            <RatingStars value={review.rating} />
                            <span>Anonymous student · {formatDate(review.createdAt)}</span>
                          </div>
                          <p>{review.comment || 'No written comment.'}</p>
                        </article>
                      ))}
                    </div>

                    <div className="find-mentor-profile-section find-mentor-profile-section--review">
                      <h3>Your anonymous review</h3>
                      {selectedMentor.connectionStatus === 'accepted' ? (
                        <form onSubmit={handleReviewSubmit} className="find-mentor-review-form">
                          <RatingStars
                            value={reviewDraft.rating}
                            interactive={true}
                            onChange={(rating) => setReviewDraft((prev) => ({ ...prev, rating }))}
                          />
                          <textarea
                            value={reviewDraft.comment}
                            onChange={(event) => setReviewDraft((prev) => ({ ...prev, comment: event.target.value.slice(0, 500) }))}
                            placeholder="Write your review anonymously..."
                            maxLength={500}
                          />
                          <div className="find-mentor-review-form__footer">
                            <span>{reviewDraft.comment.length}/500 characters · your name will not be shown</span>
                            <button type="submit" className="btn btn-primary" disabled={reviewSaving}>
                              {reviewSaving ? 'Saving...' : selectedMentor.currentUserReview ? 'Update review' : 'Submit review'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="find-mentor-reviews__empty">You can review this mentor anonymously after they accept your request.</div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
