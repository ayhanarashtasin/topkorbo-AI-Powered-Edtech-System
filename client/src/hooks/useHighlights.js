import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';

export function useHighlights({ bookId, chapterId, apiBase }) {
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHighlights = useCallback(async () => {
    if (!bookId || !chapterId) return;
    const token = localStorage.getItem('topkorbo_token');
    if (!token) return;

    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/highlights?chapterId=${chapterId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setHighlights(data.data.highlights || []);
      }
    } catch (err) {
      console.error('Error fetching highlights:', err);
    } finally {
      setLoading(false);
    }
  }, [bookId, chapterId, apiBase]);

  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  const addHighlight = async (highlightData) => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) return;

    try {
      // Optimistic UI update
      const optimisticId = `local-${Date.now()}`;
      const newHighlight = { ...highlightData, _id: optimisticId };
      setHighlights((prev) => [...prev, newHighlight]);

      const res = await fetch(`${apiBase}/highlights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ bookId, chapterId, ...highlightData })
      });
      const data = await res.json();
      
      if (data.success) {
        // Replace optimistic highlight with server highlight
        setHighlights((prev) => prev.map(h => h._id === optimisticId ? data.data : h));
        return data.data;
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      console.error('Failed to save highlight:', err);
      toast.error('Failed to save highlight');
      // Rollback optimistic update
      setHighlights((prev) => prev.filter(h => !h._id.toString().startsWith('local-')));
    }
  };

  const updateHighlight = async (id, updates) => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) return;

    try {
      // Optimistic update
      setHighlights((prev) => prev.map(h => h._id === id ? { ...h, ...updates } : h));

      const res = await fetch(`${apiBase}/highlights/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
    } catch (err) {
      console.error('Failed to update highlight:', err);
      // Removed toast notification for smoother rapid erasing
      fetchHighlights();
    }
  };

  const deleteHighlight = async (id) => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) return;

    try {
      // Optimistic delete
      setHighlights((prev) => prev.filter(h => h._id !== id));

      const res = await fetch(`${apiBase}/highlights/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
    } catch (err) {
      console.error('Failed to delete highlight:', err);
      // Removed toast notification for smoother rapid erasing
      fetchHighlights();
    }
  };

  return {
    highlights,
    loading,
    addHighlight,
    updateHighlight,
    deleteHighlight,
    refreshHighlights: fetchHighlights
  };
}
