import { useEffect, useMemo, useState } from 'react';
import forumApi from '../../services/forumApi';
import { useForum } from '../../context/ForumContext';

export default function CategoryPicker({ active, onChange }) {
  const { categories } = useForum();
  const [fetchedCategories, setFetchedCategories] = useState([]);

  useEffect(() => {
    if (categories?.length) return undefined;
    let mounted = true;
    forumApi.categories()
      .then((response) => {
        if (mounted) setFetchedCategories(response.data || []);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [categories]);

  const visibleCategories = useMemo(() => {
    const source = categories?.length ? categories : fetchedCategories;
    const hasAll = source.some((category) => category.name === 'All');
    return hasAll ? source : [{ name: 'All', count: 0 }, ...source];
  }, [categories, fetchedCategories]);

  return (
    <div className="forum-categories" role="tablist" aria-label="Discussion topics">
      {visibleCategories.map((category) => (
        <button
          key={category.name}
          type="button"
          role="tab"
          aria-selected={active === category.name}
          aria-controls="forum-feed-results"
          className={`forum-category-chip ${active === category.name ? 'forum-category-chip--active' : ''}`}
          onClick={() => onChange?.(category.name)}
        >
          <span>{category.name}</span>
          {category.count > 0 ? (
            <span className="forum-category-chip__count" aria-label={`${category.count} posts`}>
              {category.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
