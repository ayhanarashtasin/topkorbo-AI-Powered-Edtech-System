import { useNavigate } from 'react-router-dom';

export default function UserAvatar({ user, size = 'md', to }) {
  const navigate = useNavigate();
  const cls = `forum-avatar ${size === 'sm' ? 'forum-avatar--sm' : ''} ${size === 'lg' ? 'forum-avatar--lg' : ''}`;
  const initial = (user?.name || user?.username || '?').charAt(0).toUpperCase();
  const handle = (e) => {
    if (!to) return;
    e.stopPropagation();
    if (user?._id) navigate(`/forum/u/${user._id}`);
  };
  return (
    <div className={cls} onClick={handle} role={to ? 'button' : undefined} style={to ? { cursor: 'pointer' } : undefined}>
      {user?.avatar ? (
        <img src={user.avatar} alt={user.name || 'avatar'} loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}