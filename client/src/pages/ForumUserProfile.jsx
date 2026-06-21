import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import forumApi from '../services/forumApi';
import InfiniteFeed from '../components/forum/InfiniteFeed';
import UserAvatar from '../components/forum/UserAvatar';
import FollowButton from '../components/forum/FollowButton';
import LoadingSkeleton from '../components/forum/LoadingSkeleton';
import EmptyState from '../components/forum/EmptyState';
import { useForum } from '../context/ForumContext';

export default function ForumUserProfile() {
  const { user } = useForum();
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setError(null);
    (async () => {
      try {
        const r = await forumApi.getUser(id);
        if (!cancelled) setProfile(r.data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (error) {
    return (
      <EmptyState
        title="Profile not found"
        message={error}
        action={<button className="forum-btn forum-btn--primary" onClick={() => navigate('/forum')}>Back to feed</button>}
      />
    );
  }
  if (!profile) return <LoadingSkeleton count={2} />;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="forum-profile-header">
        <UserAvatar user={profile} size="lg" />
        <div className="forum-profile-header__info">
          <div className="forum-profile-header__name">
            {profile.name}
            {profile.role === 'tutor' && <span className="forum-profile-header__role">Tutor</span>}
            {profile.role === 'teacher' && <span className="forum-profile-header__role">Teacher</span>}
            {profile.forumRole === 'admin' && (
              <span className="forum-profile-header__role" style={{ background: 'rgba(225,29,72,0.12)', color: '#be123c' }}>
                Admin
              </span>
            )}
            <span className="forum-rep" title="Reputation">★ {profile.reputation || 0}</span>
          </div>
          {profile.bio && <p className="forum-profile-header__bio">{profile.bio}</p>}
          <div className="forum-profile-stats">
            {[
              profile.universityName ? <strong>{profile.universityName}</strong> : null,
              profile.department,
              profile.collegeName,
              profile.hscBatch ? `HSC ${profile.hscBatch}` : null,
              <span><strong>{(profile.followers || []).length}</strong> followers</span>,
              <span><strong>{(profile.following || []).length}</strong> following</span>
            ].filter(Boolean).map((item, i, arr) => (
              <span key={i}>
                {item}
                {i < arr.length - 1 && <span style={{ margin: '0 6px', opacity: 0.5 }}>&middot;</span>}
              </span>
            ))}
          </div>
        </div>
        {user?._id !== profile._id && <FollowButton userId={profile._id} />}
      </div>

      <h3 style={{ marginBottom: 12 }}>Posts</h3>
      <InfiniteFeed
        feedKey={`user:${profile._id}`}
        fetchPage={(cursor) => forumApi.postsByUser(profile._id, cursor)}
        emptyTitle="No posts yet"
        emptyMessage={`${profile.name} hasn't posted anything yet.`}
      />
    </div>
  );
}