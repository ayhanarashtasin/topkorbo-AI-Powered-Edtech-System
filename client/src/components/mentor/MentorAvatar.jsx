function getInitial(name) {
  const normalizedName = String(name || '').trim();
  return normalizedName ? normalizedName.charAt(0).toUpperCase() : 'M';
}

export default function MentorAvatar({ mentor, variant = 'card' }) {
  const isProfile = variant === 'profile';
  const size = isProfile ? 88 : 64;
  const name = mentor?.name || 'Mentor';

  return (
    <div className={`find-mentor-avatar find-mentor-avatar--${variant}`}>
      {mentor?.avatar ? (
        <img
          src={mentor.avatar}
          alt={`${name}'s profile`}
          width={size}
          height={size}
          loading={isProfile ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span aria-hidden="true">{getInitial(name)}</span>
      )}
    </div>
  );
}
