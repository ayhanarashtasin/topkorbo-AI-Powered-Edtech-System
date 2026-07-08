import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Leaderboard has been merged into the Contests page.
// This component exists only to redirect old bookmarks / shared URLs.
export default function Leaderboard() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/contests', { replace: true });
  }, [navigate]);
  return null;
}
