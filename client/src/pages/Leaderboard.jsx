import { useState, useEffect } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { HiTrophy } from 'react-icons/hi2';
import Sidebar from '../components/layout/Sidebar';
import { getGlobalLeaderboard } from '../services/contestApi';
import './Contests.css';

export default function Leaderboard() {
  const { language } = useLanguage();
  const [user] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Student',
    role: localStorage.getItem('topkorbo_role') || 'student'
  });

  const [by, setBy] = useState('points');
  const [rows, setRows] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getGlobalLeaderboard(by, 50)
      .then((data) => {
        if (cancelled) return;
        setRows(data?.leaderboard || []);
        setMe(data?.me || null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Leaderboard fetch failed:', err);
        setError(language === 'en' ? 'Could not load the leaderboard.' : 'লিডারবোর্ড লোড করা যায়নি।');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [by, language]);

  const metricLabel = by === 'points'
    ? (language === 'en' ? 'Points' : 'পয়েন্ট')
    : (language === 'en' ? 'Rating' : 'রেটিং');

  const metricValue = (row) => (by === 'points' ? row.contestPoints : `${row.rating} (${row.rankTitle})`);

  const rankMedal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`);

  return (
    <div className="contests-page">
      <Sidebar activeTab="leaderboard" user={user} />

      <main className="contests-content">
        <section className="contests-table-section">
          <div className="contests-section-header">
            <div className="contests-section-header__icon contests-section-header__icon--active">
              <HiTrophy size={20} />
            </div>
            <div>
              <h2 className="contests-section-title">
                {language === 'en' ? 'Global Leaderboard' : 'গ্লোবাল লিডারবোর্ড'}
              </h2>
              <p className="contests-section-subtitle">
                {language === 'en'
                  ? 'Ranked across all contest participants.'
                  : 'সকল কনটেস্ট অংশগ্রহণকারীর মধ্যে র‍্যাংকিং।'}
              </p>
            </div>
          </div>

          {/* Points / Rating toggle */}
          <div style={{ display: 'flex', gap: 8, margin: '4px 0 16px' }}>
            {['points', 'rating'].map((key) => (
              <button
                key={key}
                onClick={() => setBy(key)}
                className="contest-table-cta"
                style={{
                  cursor: 'pointer',
                  background: by === key ? '#8C5A3C' : 'transparent',
                  color: by === key ? '#fff' : '#8C5A3C',
                  border: '1.5px solid #8C5A3C'
                }}
              >
                {key === 'points'
                  ? (language === 'en' ? 'By Points' : 'পয়েন্ট অনুযায়ী')
                  : (language === 'en' ? 'By Rating' : 'রেটিং অনুযায়ী')}
              </button>
            ))}
          </div>

          {me && (
            <div
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', marginBottom: 16, borderRadius: 12,
                background: 'rgba(140, 90, 60, 0.08)', border: '1px solid rgba(140, 90, 60, 0.25)', fontWeight: 700
              }}
            >
              <span>{language === 'en' ? 'Your rank' : 'আপনার র‍্যাংক'}: {rankMedal(me.rank)}</span>
              <span>{metricLabel}: {by === 'points' ? me.contestPoints : `${me.rating} (${me.rankTitle})`}</span>
            </div>
          )}

          <div className="contests-card">
            {loading ? (
              <div className="contests-empty-state">{language === 'en' ? 'Loading…' : 'লোড হচ্ছে…'}</div>
            ) : error ? (
              <div className="contests-empty-state">{error}</div>
            ) : rows.length === 0 ? (
              <div className="contests-empty-state">
                {language === 'en' ? 'No ranked participants yet.' : 'এখনও কোনো র‍্যাংকড অংশগ্রহণকারী নেই।'}
              </div>
            ) : (
              <div className="contests-table-container">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 14px' }}>{language === 'en' ? 'Rank' : 'র‍্যাংক'}</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px' }}>{language === 'en' ? 'Student' : 'শিক্ষার্থী'}</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px' }}>{metricLabel}</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px' }}>{language === 'en' ? 'Contests' : 'কনটেস্ট'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const isMe = me && row._id && String(row._id) === String(me._id);
                      return (
                        <tr key={row._id || row.rank} style={{ background: isMe ? 'rgba(140, 90, 60, 0.08)' : 'transparent' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 700 }}>{rankMedal(row.rank)}</td>
                          <td style={{ padding: '10px 14px' }}>
                            {row.name || row.username || (language === 'en' ? 'Student' : 'শিক্ষার্থী')}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{metricValue(row)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.contestsPlayed}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
