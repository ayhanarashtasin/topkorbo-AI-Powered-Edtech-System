import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HiFilter, HiRefresh, HiSearch, HiUserGroup, HiX } from 'react-icons/hi';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '../components/layout/Sidebar';
import MentorCard from '../components/mentor/MentorCard';
import MentorProfileDialog from '../components/mentor/MentorProfileDialog';
import { fetchMentorProfile, fetchMentors, sendMentorRequest, submitMentorReview } from '../services/mentorApi';
import './FindMentor.css';

const VALID_SORTS = new Set(['rating', 'newest', 'name']);
const numberFormatter = new Intl.NumberFormat('en-US');

function getStoredUser() {
  return {
    name: localStorage.getItem('topkorbo_name') || 'Student',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'student'
  };
}

function MentorGridSkeleton() {
  return (
    <div className="find-mentor-grid" role="status" aria-label="Loading mentors">
      {[1, 2, 3].map((item) => (
        <div key={item} className="find-mentor-card find-mentor-card--skeleton" aria-hidden="true">
          <div className="find-mentor-skeleton find-mentor-skeleton--pill" />
          <div className="find-mentor-card__skeleton-profile">
            <div className="find-mentor-skeleton find-mentor-skeleton--avatar" />
            <div>
              <div className="find-mentor-skeleton find-mentor-skeleton--title" />
              <div className="find-mentor-skeleton find-mentor-skeleton--line" />
            </div>
          </div>
          <div className="find-mentor-skeleton find-mentor-skeleton--line" />
          <div className="find-mentor-skeleton find-mentor-skeleton--block" />
        </div>
      ))}
      <span className="sr-only">Loading mentors…</span>
    </div>
  );
}

export default function FindMentor() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user] = useState(getStoredUser);
  const [mentors, setMentors] = useState([]);
  const [knownUniversities, setKnownUniversities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestingMentorId, setRequestingMentorId] = useState('');
  const [selectedMentorId, setSelectedMentorId] = useState('');
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [reviewDraft, setReviewDraft] = useState({ rating: 5, comment: '' });
  const [reviewSaving, setReviewSaving] = useState(false);
  const listRequestIdRef = useRef(0);
  const profileRequestIdRef = useRef(0);

  const requestedSort = searchParams.get('sort') || 'rating';
  const sort = VALID_SORTS.has(requestedSort) ? requestedSort : 'rating';
  const university = searchParams.get('university') || '';
  const search = searchParams.get('q') || '';

  const applyMentorResults = useCallback((data, requestId) => {
    if (requestId !== listRequestIdRef.current) return;

    const nextMentors = Array.isArray(data) ? data : [];
    setError('');
    setMentors(nextMentors);
    setKnownUniversities((currentUniversities) => {
      const mergedUniversities = new Set(currentUniversities);
      nextMentors.forEach((mentor) => {
        if (mentor.universityName) mergedUniversities.add(mentor.universityName);
      });
      return Array.from(mergedUniversities).sort((a, b) => a.localeCompare(b));
    });
  }, []);

  const loadMentors = useCallback(async () => {
    const requestId = ++listRequestIdRef.current;

    try {
      const data = await fetchMentors({ sort, university });
      applyMentorResults(data, requestId);
    } catch (loadError) {
      if (requestId === listRequestIdRef.current) {
        setError(loadError.message || 'Mentors could not be loaded.');
      }
    } finally {
      if (requestId === listRequestIdRef.current) setLoading(false);
    }
  }, [applyMentorResults, sort, university]);

  useEffect(() => {
    document.title = 'Find a Mentor | TopKorbo';

    if (user.role !== 'student') {
      navigate('/dashboard', { replace: true });
      return undefined;
    }

    const requestId = ++listRequestIdRef.current;
    void fetchMentors({ sort, university })
      .then((data) => applyMentorResults(data, requestId))
      .catch((loadError) => {
        if (requestId === listRequestIdRef.current) {
          setError(loadError.message || 'Mentors could not be loaded.');
        }
      })
      .finally(() => {
        if (requestId === listRequestIdRef.current) setLoading(false);
      });

    return () => {
      listRequestIdRef.current += 1;
    };
  }, [applyMentorResults, navigate, sort, university, user.role]);

  const filteredMentors = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    if (!normalizedQuery) return mentors;

    return mentors.filter((mentor) => [
      mentor.name,
      mentor.universityName,
      mentor.department,
      mentor.currentYearSemester,
      mentor.admissionAchievement,
      ...(mentor.interestedToGuide || [])
    ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)));
  }, [mentors, search]);

  const pageStats = useMemo(() => {
    let openToRequests = 0;
    let connected = 0;

    mentors.forEach((mentor) => {
      if (mentor.connectionStatus === 'accepted') connected += 1;
      if (!mentor.connectionStatus || mentor.connectionStatus === 'none' || mentor.connectionStatus === 'declined') openToRequests += 1;
    });

    return { openToRequests, connected };
  }, [mentors]);

  const universityOptions = useMemo(() => {
    if (!university || knownUniversities.includes(university)) return knownUniversities;
    return [university, ...knownUniversities];
  }, [knownUniversities, university]);

  const updateFilter = useCallback((key, value) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      const isDefaultSort = key === 'sort' && value === 'rating';

      if (!value || isDefaultSort) nextParams.delete(key);
      else nextParams.set(key, value);

      return nextParams;
    }, { replace: true });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const retryMentors = useCallback(() => {
    setLoading(true);
    setError('');
    void loadMentors();
  }, [loadMentors]);

  const closeProfile = useCallback(() => {
    profileRequestIdRef.current += 1;
    setSelectedMentorId('');
    setSelectedMentor(null);
    setProfileError('');
    setProfileLoading(false);
  }, []);

  const openProfile = useCallback(async (mentorId, mentorPreview = null) => {
    const requestId = ++profileRequestIdRef.current;
    setSelectedMentorId(mentorId);
    setSelectedMentor(mentorPreview ? {
      ...mentorPreview,
      reviews: mentorPreview.recentReviews || []
    } : null);
    setProfileLoading(true);
    setProfileError('');

    try {
      const data = await fetchMentorProfile(mentorId);
      if (requestId !== profileRequestIdRef.current) return;

      setSelectedMentor(data);
      setReviewDraft({
        rating: data?.currentUserReview?.rating || 5,
        comment: data?.currentUserReview?.comment || ''
      });
    } catch (loadError) {
      if (requestId === profileRequestIdRef.current) {
        setProfileError(loadError.message || 'The mentor profile could not be loaded.');
      }
    } finally {
      if (requestId === profileRequestIdRef.current) setProfileLoading(false);
    }
  }, []);

  const handleMentorRequest = useCallback(async (mentorId) => {
    try {
      setRequestingMentorId(mentorId);
      await sendMentorRequest(mentorId);

      const refreshTasks = [loadMentors()];
      if (selectedMentorId === mentorId) refreshTasks.push(openProfile(mentorId, selectedMentor));
      await Promise.all(refreshTasks);

      toast.success('Mentor request sent. You can track it from your dashboard.');
    } catch (requestError) {
      toast.error(requestError.message || 'The request could not be sent. Please try again.');
    } finally {
      setRequestingMentorId('');
    }
  }, [loadMentors, openProfile, selectedMentor, selectedMentorId]);

  const handleReviewSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (!selectedMentorId) return;

    try {
      setReviewSaving(true);
      await submitMentorReview(selectedMentorId, reviewDraft);
      await Promise.all([
        loadMentors(),
        openProfile(selectedMentorId, selectedMentor)
      ]);
      toast.success(selectedMentor?.currentUserReview ? 'Your review was updated.' : 'Your review was submitted anonymously.');
    } catch (reviewError) {
      toast.error(reviewError.message || 'The review could not be saved. Please try again.');
    } finally {
      setReviewSaving(false);
    }
  }, [loadMentors, openProfile, reviewDraft, selectedMentor, selectedMentorId]);

  const hasActiveFilters = Boolean(search || university || sort !== 'rating');

  return (
    <div className="dashboard-container">
      <a className="find-mentor-skip-link" href="#mentor-results">Skip to mentor results</a>
      <Sidebar activeTab="find-mentor" user={user} />
      <main className="dashboard-main" id="mentor-main">
        <div className="find-mentor-page">
          <section className="find-mentor-hero" aria-labelledby="find-mentor-title">
            <div className="find-mentor-hero__icon" aria-hidden="true">
              <HiUserGroup size={24} />
            </div>

            <div className="find-mentor-hero__copy">
              <span className="find-mentor-eyebrow">Mentor Match</span>
              <h1 id="find-mentor-title">Find guidance for your next move.</h1>
              <p>Compare academic paths, guidance areas, and student feedback before sending a request.</p>
            </div>

            <div className="find-mentor-hero__meta">
              <dl
                className="find-mentor-hero__stats"
                aria-label="Mentor overview"
                aria-live="polite"
                aria-busy={loading}
              >
                <div>
                  <dd>{numberFormatter.format(loading ? 0 : pageStats.openToRequests)}</dd>
                  <dt>Open to requests</dt>
                </div>
                <div>
                  <dd>{numberFormatter.format(loading ? 0 : pageStats.connected)}</dd>
                  <dt>Your connections</dt>
                </div>
              </dl>
            </div>
          </section>

          <section className="find-mentor-discovery" aria-labelledby="mentor-filters-title">
            <div className="find-mentor-discovery__heading">
              <div>
                <span>Discovery desk</span>
                <h2 id="mentor-filters-title">Narrow the shortlist</h2>
              </div>
              {hasActiveFilters ? (
                <button type="button" className="find-mentor-clear" onClick={clearFilters}>
                  <HiX size={16} aria-hidden="true" />
                  Clear filters
                </button>
              ) : null}
            </div>

            <div className="find-mentor-toolbar">
              <label className="find-mentor-field find-mentor-field--search" htmlFor="mentor-search">
                <span>Search mentors</span>
                <span className="find-mentor-field__control">
                  <HiSearch size={19} aria-hidden="true" />
                  <input
                    id="mentor-search"
                    name="mentor-search"
                    type="search"
                    value={search}
                    onChange={(event) => updateFilter('q', event.target.value)}
                    placeholder="Name, subject, or achievement…"
                    autoComplete="off"
                  />
                </span>
              </label>

              <label className="find-mentor-field" htmlFor="mentor-sort">
                <span>Sort by</span>
                <span className="find-mentor-field__control">
                  <HiFilter size={18} aria-hidden="true" />
                  <select id="mentor-sort" name="mentor-sort" value={sort} onChange={(event) => updateFilter('sort', event.target.value)}>
                    <option value="rating">Highest rated</option>
                    <option value="newest">Newest mentors</option>
                    <option value="name">Name A–Z</option>
                  </select>
                </span>
              </label>

              <label className="find-mentor-field" htmlFor="mentor-university">
                <span>University</span>
                <span className="find-mentor-field__control">
                  <HiUserGroup size={18} aria-hidden="true" />
                  <select id="mentor-university" name="mentor-university" value={university} onChange={(event) => updateFilter('university', event.target.value)}>
                    <option value="">All universities</option>
                    {universityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </span>
              </label>
            </div>
          </section>

          <section className="find-mentor-results" id="mentor-results" aria-labelledby="mentor-results-title">
            <div className="find-mentor-results__heading">
              <div>
                <span>Curated for your goal</span>
                <h2 id="mentor-results-title">Mentors for You</h2>
              </div>
              <p aria-live="polite">
                {loading ? 'Finding mentors…' : `${numberFormatter.format(filteredMentors.length)} mentor${filteredMentors.length === 1 ? '' : 's'} found`}
              </p>
            </div>

            {error ? (
              <div className="find-mentor-alert" role="alert">
                <div>
                  <strong>Mentors couldn’t be loaded</strong>
                  <p>{error} Check your connection, then try again.</p>
                </div>
                <button type="button" className="find-mentor-button find-mentor-button--secondary" onClick={retryMentors}>
                  <HiRefresh size={17} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : null}

            {loading ? <MentorGridSkeleton /> : null}

            {!loading && !error && filteredMentors.length === 0 ? (
              <div className="find-mentor-empty">
                <span aria-hidden="true"><HiSearch size={24} /></span>
                <h3>No mentors match this search</h3>
                <p>Try a broader name or subject, or reset the university filter.</p>
                {hasActiveFilters ? (
                  <button type="button" className="find-mentor-button find-mentor-button--primary" onClick={clearFilters}>Reset filters</button>
                ) : null}
              </div>
            ) : null}

            {!loading && !error && filteredMentors.length > 0 ? (
              <div className="find-mentor-grid">
                {filteredMentors.map((mentor) => (
                  <MentorCard
                    key={mentor._id}
                    mentor={mentor}
                    isRequesting={requestingMentorId === mentor._id}
                    onOpen={openProfile}
                    onRequest={handleMentorRequest}
                  />
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </main>

      {selectedMentorId ? (
        <MentorProfileDialog
          mentor={selectedMentor}
          isLoading={profileLoading}
          error={profileError}
          isRequesting={requestingMentorId === selectedMentorId}
          reviewDraft={reviewDraft}
          reviewSaving={reviewSaving}
          onClose={closeProfile}
          onRetry={() => openProfile(selectedMentorId, selectedMentor)}
          onRequest={handleMentorRequest}
          onReviewChange={setReviewDraft}
          onReviewSubmit={handleReviewSubmit}
        />
      ) : null}
    </div>
  );
}
