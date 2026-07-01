import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HiUserAdd, HiUserRemove } from 'react-icons/hi';
import forumApi from '../../services/forumApi';

// FollowButton — toggles the current user's follow state of `userId`
// with optimistic UI and a toast confirmation.
export default function FollowButton({ userId, initialFollowing, onChange }) {
  const [following, setFollowing] = useState(!!initialFollowing);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFollowing(!!initialFollowing);
  }, [initialFollowing]);

  async function toggle() {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const json = following
        ? await forumApi.unfollow(userId)
        : await forumApi.follow(userId);
      const next = !!json?.data?.following;
      setFollowing(next);
      onChange && onChange(next, json?.data);
      toast.success(next ? 'Following' : 'Unfollowed');
    } catch (e) {
      toast.error(e.message || 'Could not update follow state.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`forum-follow-btn ${following ? 'forum-follow-btn--following' : ''}`}
      onClick={toggle}
      disabled={busy}
    >
      {following ? <HiUserRemove size={16} /> : <HiUserAdd size={16} />}
      <span>{following ? 'Following' : 'Follow'}</span>
    </button>
  );
}