import { Link } from 'react-router-dom';

const AVATAR_PIXELS = { sm: 32, md: 42, lg: 88 };

function AvatarVisual({ user, size = 'md' }) {
  const className = `forum-avatar ${size === 'sm' ? 'forum-avatar--sm' : ''} ${size === 'lg' ? 'forum-avatar--lg' : ''}`;
  const initial = (user?.name || user?.username || '?').charAt(0).toUpperCase();
  const pixels = AVATAR_PIXELS[size] || AVATAR_PIXELS.md;

  return (
    <span className={className} aria-hidden="true">
      {user?.avatar ? (
        <img
          src={user.avatar}
          alt=""
          width={pixels}
          height={pixels}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>{initial}</span>
      )}
    </span>
  );
}

export default function UserAvatar({ user, size = 'md' }) {
  return <AvatarVisual user={user} size={size} />;
}

export function UserAvatarLink({ user, size = 'md' }) {
  if (!user?._id) return <AvatarVisual user={user} size={size} />;

  return (
    <Link
      className="forum-avatar-link"
      to={`/forum/u/${user._id}`}
      aria-label={`View ${user.name || user.username || 'community member'}'s profile`}
      onClick={(event) => event.stopPropagation()}
    >
      <AvatarVisual user={user} size={size} />
    </Link>
  );
}
