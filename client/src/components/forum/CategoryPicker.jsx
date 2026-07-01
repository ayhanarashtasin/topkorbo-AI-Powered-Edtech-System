import { useEffect, useState } from 'react';
import forumApi from '../../services/forumApi';
import { useForum } from '../../context/ForumContext';

// CategoryPicker — horizontal category chips shown above the feed.
// Driven by /api/search/categories which returns each category's post count.
export default function CategoryPicker({ active, onChange }) {
  const { categories } = useForum();
  const [localCats, setLocalCats] = useState([]);

  useEffect(() => {
    if (categories?.length) {
      setLocalCats(categories);
      return;
    }
    let mounted = true;
    forumApi.categories().then((r) => {
      if (mounted) setLocalCats(r.data || []);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [categories]);

  return (
    <div className="forum-categories" role="tablist" aria-label="Categories">
      {localCats.map((c) => (
        <button
          key={c.name}
          type="button"
          role="tab"
          aria-selected={active === c.name}
          className={`forum-category-chip ${active === c.name ? 'forum-category-chip--active' : ''}`}
          onClick={() => onChange && onChange(c.name)}
        >
          {c.name}
          {c.count > 0 && <span className="forum-category-chip__count">{c.count}</span>}
        </button>
      ))}
    </div>
  );
}