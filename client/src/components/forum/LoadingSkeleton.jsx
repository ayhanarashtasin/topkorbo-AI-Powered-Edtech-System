// LoadingSkeleton — shimmer placeholders shown while post cards are loading.
export default function LoadingSkeleton({ count = 3 }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="forum-skeleton" aria-hidden="true">
          <div className="forum-skeleton__line short" />
          <div className="forum-skeleton__line long" />
          <div className="forum-skeleton__line medium" />
          <div className="forum-skeleton__line long" />
          <div className="forum-skeleton__line short" />
        </div>
      ))}
    </div>
  );
}