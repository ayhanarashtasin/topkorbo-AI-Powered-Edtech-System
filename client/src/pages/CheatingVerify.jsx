import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiShieldExclamation,
  HiShieldCheck,
  HiRefresh,
  HiX,
  HiCheckCircle,
  HiPhotograph,
  HiChevronLeft,
  HiChevronRight,
  HiSearch,
  HiUserGroup,
  HiCalendar,
  HiClock,
  HiAcademicCap,
  HiArrowLeft,
  HiArrowRight,
  HiExclamationCircle,
  HiEye,
  HiBan,
  HiFilter,
  HiTrash
} from 'react-icons/hi';
import toast from 'react-hot-toast';
import Sidebar from '../components/layout/Sidebar';
import { useLanguage } from '../hooks/useLanguage';
import {
  getMyContestViolations,
  reviewViolation,
  reviewStudentViolations,
  deleteStudentViolations,
  deleteViolation
} from '../services/proctorApi';
import './CheatingVerify.css';

// Review state metadata (clean typography and color themes, zero emojis)
const STATUS_META = {
  pending_review: {
    cls: 'pending',
    labelEn: 'Pending Review',
    labelBn: 'পর্যালোচনার অপেক্ষায়',
    badgeTextEn: 'Action Required',
    badgeTextBn: 'পর্যালোচনা প্রয়োজন'
  },
  confirmed_cheating: {
    cls: 'confirmed',
    labelEn: 'Confirmed Cheating',
    labelBn: 'নিশ্চিত অসদুপায়',
    badgeTextEn: 'Disqualified',
    badgeTextBn: 'বহিষ্কৃত'
  },
  dismissed_false_positive: {
    cls: 'dismissed',
    labelEn: 'Dismissed',
    labelBn: 'বাতিল (ভুল শনাক্ত)',
    badgeTextEn: 'Cleared',
    badgeTextBn: 'অব্যাহতি'
  }
};

function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return String(ts || '—');
  }
}

function formatShortDate(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return String(ts || '—');
  }
}

function isRenderableSnapshot(url) {
  return typeof url === 'string' && (url.startsWith('http') || url.startsWith('data:image'));
}

export default function CheatingVerify() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const en = language === 'en';

  const [user, setUser] = useState({
    name: localStorage.getItem('topkorbo_name') || 'Teacher',
    avatar: localStorage.getItem('topkorbo_avatar') || '',
    email: localStorage.getItem('topkorbo_email') || '',
    role: localStorage.getItem('topkorbo_role') || 'teacher'
  });

  // Data states
  const [violations, setViolations] = useState([]);
  const [contests, setContests] = useState([]);
  const [summary, setSummary] = useState({
    totalContests: 0,
    totalViolations: 0,
    pending: 0,
    confirmed: 0,
    dismissed: 0,
    flaggedStudents: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 3-Tier Navigation State:
  // selectedContestId: null -> Tier 1 (Contest Overview)
  // selectedContestId: 'xyz', selectedStudentId: null -> Tier 2 (Students in Contest)
  // selectedContestId: 'xyz', selectedStudentId: 'abc' -> Tier 3 (Evidence Dossier)
  const [selectedContestId, setSelectedContestId] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // Filters for Tier 1 & Tier 2
  const [contestSearch, setContestSearch] = useState('');
  const [contestStatusFilter, setContestStatusFilter] = useState('all'); // all, action_required, clean, has_flags
  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState('all'); // all, pending, confirmed, dismissed

  // Evidence Modal / Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState(null); // index in active student snapshots
  const [reviewNote, setReviewNote] = useState('');
  const [batchNote, setBatchNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Deletion Modal State
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'student' | 'single', ... }
  const [deleting, setDeleting] = useState(false);

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) {
      navigate('/');
      return;
    }
    const backendBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    fetch(`${backendBaseUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.status === 401) {
          localStorage.removeItem('topkorbo_token');
          navigate('/');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.success && data.data) {
          const u = data.data;
          setUser({ name: u.name || 'Teacher', avatar: u.avatar || '', email: u.email || '', role: u.role || 'teacher' });
        }
      })
      .catch((err) => console.error('[CheatingVerify] auth/me error:', err));
  }, [navigate]);

  // Load all violation records
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyContestViolations({ limit: 150 });
      setViolations(Array.isArray(data?.items) ? data.items : []);
      setContests(Array.isArray(data?.contests) ? data.contests : []);
      if (data?.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      setError(err?.message || (en ? 'Failed to load proctoring records' : 'প্রক্টরিং রেকর্ড লোড করতে ব্যর্থ হয়েছে'));
      setViolations([]);
      setContests([]);
    } finally {
      setLoading(false);
    }
  }, [en]);

  useEffect(() => {
    // The page owns this initial remote-data synchronization; later refreshes use the same callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  // Real-time computed statistics map per contest derived from the loaded violations array
  const computedContestStats = useMemo(() => {
    const map = {};
    if (Array.isArray(contests)) {
      contests.forEach((c) => {
        if (!c || !c._id) return;
        const cId = String(c._id);
        map[cId] = {
          totalViolations: 0,
          pendingCount: 0,
          confirmedCount: 0,
          dismissedCount: 0,
          flaggedStudentsSet: new Set(),
          maxConfidence: 0
        };
      });
    }

    if (Array.isArray(violations)) {
      violations.forEach((v) => {
        if (!v) return;
        const cId = String(v.contestId?._id || v.contestId || '');
        if (!cId) return;
        if (!map[cId]) {
          map[cId] = {
            totalViolations: 0,
            pendingCount: 0,
            confirmedCount: 0,
            dismissedCount: 0,
            flaggedStudentsSet: new Set(),
            maxConfidence: 0
          };
        }
        map[cId].totalViolations += 1;
        if (v.status === 'pending_review') map[cId].pendingCount += 1;
        else if (v.status === 'confirmed_cheating') map[cId].confirmedCount += 1;
        else if (v.status === 'dismissed_false_positive') map[cId].dismissedCount += 1;

        const sId = String(v.studentId?._id || v.studentId || '');
        if (sId) map[cId].flaggedStudentsSet.add(sId);
        if (typeof v.confidence === 'number' && v.confidence > map[cId].maxConfidence) {
          map[cId].maxConfidence = v.confidence;
        }
      });
    }

    return map;
  }, [contests, violations]);

  // Group violations by contest and student for structured tiers
  const activeContest = useMemo(() => {
    if (!selectedContestId || !Array.isArray(contests)) return null;
    return contests.find((c) => c && String(c._id) === String(selectedContestId)) || null;
  }, [contests, selectedContestId]);

  // All violations for active contest
  const contestViolations = useMemo(() => {
    if (!selectedContestId || !Array.isArray(violations)) return [];
    return violations.filter(
      (v) => v && String(v.contestId?._id || v.contestId || '') === String(selectedContestId)
    );
  }, [violations, selectedContestId]);

  // Flagged students in active contest
  const flaggedStudentsInContest = useMemo(() => {
    if (!selectedContestId || !Array.isArray(contestViolations)) return [];
    const studentMap = new Map();

    contestViolations.forEach((v) => {
      if (!v) return;
      const sId = String(v.studentId?._id || v.studentId || 'unknown');
      if (!studentMap.has(sId)) {
        const studentName = (typeof v.studentId === 'object' && v.studentId?.name)
          ? v.studentId.name
          : (en ? 'Candidate' : 'শিক্ষার্থী');
        const studentEmail = (typeof v.studentId === 'object' && v.studentId?.email)
          ? v.studentId.email
          : '—';
        const studentAvatar = (typeof v.studentId === 'object' && v.studentId?.avatar)
          ? v.studentId.avatar
          : '';

        studentMap.set(sId, {
          id: sId,
          name: studentName,
          email: studentEmail,
          avatar: studentAvatar,
          violations: [],
          pendingCount: 0,
          confirmedCount: 0,
          dismissedCount: 0,
          maxConfidence: 0,
          latestTimestamp: v.timestamp || v.createdAt
        });
      }
      const record = studentMap.get(sId);
      record.violations.push(v);
      if (v.status === 'pending_review') record.pendingCount += 1;
      else if (v.status === 'confirmed_cheating') record.confirmedCount += 1;
      else if (v.status === 'dismissed_false_positive') record.dismissedCount += 1;

      if (typeof v.confidence === 'number' && v.confidence > record.maxConfidence) {
        record.maxConfidence = v.confidence;
      }
      const itemTime = new Date(v.timestamp || v.createdAt || 0).getTime();
      const prevTime = new Date(record.latestTimestamp || 0).getTime();
      if (itemTime > prevTime) {
        record.latestTimestamp = v.timestamp || v.createdAt;
      }
    });

    return Array.from(studentMap.values()).map((st) => {
      let overallStatus = 'pending_review';
      if (st.confirmedCount > 0) overallStatus = 'confirmed_cheating';
      else if (st.pendingCount === 0 && st.dismissedCount > 0) overallStatus = 'dismissed_false_positive';
      return {
        ...st,
        overallStatus
      };
    });
  }, [contestViolations, selectedContestId, en]);

  // Active student record & violations for Tier 3
  const activeStudent = useMemo(() => {
    if (!selectedStudentId || !Array.isArray(flaggedStudentsInContest)) return null;
    return flaggedStudentsInContest.find((s) => s && s.id === String(selectedStudentId)) || null;
  }, [flaggedStudentsInContest, selectedStudentId]);

  const activeStudentSnapshots = useMemo(() => {
    if (!activeStudent || !Array.isArray(activeStudent.violations)) return [];
    return activeStudent.violations;
  }, [activeStudent]);

  // Filtered lists (sorted latest date wise: latest contest 1st, then 2nd, then 3rd)
  const filteredContests = useMemo(() => {
    if (!Array.isArray(contests)) return [];
    return contests
      .filter((c) => {
        if (!c) return false;
        const cName = String(c.name || '');
        const nameMatch = cName.toLowerCase().includes((contestSearch || '').toLowerCase());
        if (!nameMatch) return false;
        const cStats = computedContestStats[String(c._id)] || c.stats || {};
        const pendingCount = cStats.pendingCount ?? (c.stats?.pendingCount || 0);
        const totalCount = cStats.totalViolations ?? (c.stats?.totalViolations || 0);
        const confirmedCount = cStats.confirmedCount ?? (c.stats?.confirmedCount || 0);

        if (contestStatusFilter === 'action_required') {
          return pendingCount > 0;
        }
        if (contestStatusFilter === 'clean') {
          return totalCount === 0;
        }
        if (contestStatusFilter === 'has_flags') {
          return totalCount > 0;
        }
        if (contestStatusFilter === 'disqualified') {
          return confirmedCount > 0;
        }
        return true;
      })
      .sort((a, b) => {
        // Latest date first:
        // Priority 1: Exam date (a.date vs b.date)
        // Priority 2: Creation timestamp (createdAt)
        const parseContestTime = (item) => {
          if (!item) return 0;
          if (item.date) {
            const parsed = new Date(item.date).getTime();
            if (!isNaN(parsed) && parsed > 0) return parsed;
          }
          if (item.createdAt) {
            const parsed = new Date(item.createdAt).getTime();
            if (!isNaN(parsed) && parsed > 0) return parsed;
          }
          return 0;
        };

        const timeA = parseContestTime(a);
        const timeB = parseContestTime(b);

        if (timeB !== timeA) {
          return timeB - timeA;
        }

        // If dates are identical, prioritize contests with recent violation activity
        const statsA = computedContestStats[String(a._id)] || a.stats || {};
        const statsB = computedContestStats[String(b._id)] || b.stats || {};
        const viTimeA = statsA.latestTimestamp ? new Date(statsA.latestTimestamp).getTime() : 0;
        const viTimeB = statsB.latestTimestamp ? new Date(statsB.latestTimestamp).getTime() : 0;
        return (viTimeB || 0) - (viTimeA || 0);
      });
  }, [contests, contestSearch, contestStatusFilter, computedContestStats]);

  const filteredStudents = useMemo(() => {
    if (!Array.isArray(flaggedStudentsInContest)) return [];
    return flaggedStudentsInContest
      .filter((s) => {
        if (!s) return false;
        const term = (studentSearch || '').toLowerCase();
        const sName = String(s.name || '').toLowerCase();
        const sEmail = String(s.email || '').toLowerCase();
        const match = sName.includes(term) || sEmail.includes(term);
        if (!match) return false;
        if (studentStatusFilter === 'pending') return s.pendingCount > 0;
        if (studentStatusFilter === 'confirmed') return s.confirmedCount > 0;
        if (studentStatusFilter === 'dismissed') return s.pendingCount === 0 && s.confirmedCount === 0;
        return true;
      })
      .sort((a, b) => {
        // Pending review candidates first, then latest alert timestamp descending
        if ((b.pendingCount > 0) !== (a.pendingCount > 0)) {
          return b.pendingCount > 0 ? 1 : -1;
        }
        const timeA = new Date(a.latestTimestamp || 0).getTime();
        const timeB = new Date(b.latestTimestamp || 0).getTime();
        return timeB - timeA;
      });
  }, [flaggedStudentsInContest, studentSearch, studentStatusFilter]);

  // Lightbox keyboard controls
  useEffect(() => {
    if (lightboxIndex === null) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      else if (e.key === 'ArrowRight') {
        setLightboxIndex((idx) => (idx < activeStudentSnapshots.length - 1 ? idx + 1 : idx));
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex((idx) => (idx > 0 ? idx - 1 : idx));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, activeStudentSnapshots.length]);

  // Delete modal keyboard controls
  useEffect(() => {
    if (!deleteTarget) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !deleting) setDeleteTarget(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteTarget, deleting]);

  // Delete violation records / screenshots from database
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'student') {
        await deleteStudentViolations(deleteTarget.contestId, deleteTarget.studentId);
        toast.success(
          en
            ? 'Cheater student screenshot records removed from database'
            : 'শিক্ষার্থীর চিটিং স্ক্রিনশট ও রেকর্ড ডাটাবেজ থেকে মুছে ফেলা হয়েছে'
        );
        // Remove all violations of this student from local state
        setViolations((prev) =>
          prev.filter((v) => {
            if (!v) return false;
            const vContest = String(v.contestId?._id || v.contestId);
            const vStudent = String(v.studentId?._id || v.studentId);
            return !(
              vContest === String(deleteTarget.contestId) &&
              vStudent === String(deleteTarget.studentId)
            );
          })
        );
        // If viewing this student in Tier 3, navigate back to candidate list
        if (selectedStudentId === String(deleteTarget.studentId)) {
          setSelectedStudentId(null);
          setLightboxIndex(null);
        }
      } else if (deleteTarget.type === 'single') {
        await deleteViolation(deleteTarget.violationId);
        toast.success(
          en
            ? 'Screenshot record removed from database'
            : 'স্ক্রিনশট রেকর্ড ডাটাবেজ থেকে মুছে ফেলা হয়েছে'
        );
        setViolations((prev) =>
          prev.filter((v) => v && v._id !== deleteTarget.violationId)
        );
        if (lightboxIndex !== null) {
          setLightboxIndex(null);
        }
      }
      setDeleteTarget(null);
    } catch (err) {
      toast.error(
        err?.message || (en ? 'Failed to delete record' : 'রেকর্ড মুছতে ব্যর্থ হয়েছে')
      );
    } finally {
      setDeleting(false);
    }
  };

  // Review single violation
  const handleReviewSingle = async (violationId, status, note = '') => {
    setReviewing(true);
    try {
      await reviewViolation(violationId, { status, reviewNote: note });
      toast.success(
        status === 'confirmed_cheating'
          ? (en ? 'Violation confirmed as cheating' : 'অসদুপায় নিশ্চিত করা হয়েছে')
          : (en ? 'Violation dismissed as false positive' : 'ভুল শনাক্ত হিসেবে বাতিল করা হয়েছে')
      );
      setViolations((prev) =>
        prev.map((v) => (v && v._id === violationId ? { ...v, status, reviewNote: note } : v))
      );
    } catch (err) {
      toast.error(err?.message || (en ? 'Failed to submit review' : 'পর্যালোচনা সংরক্ষণ ব্যর্থ হয়েছে'));
    } finally {
      setReviewing(false);
    }
  };

  // Batch review all violations for student in this contest
  const handleBatchReviewStudent = async (status) => {
    if (!selectedContestId || !selectedStudentId) return;
    setReviewing(true);
    try {
      await reviewStudentViolations(selectedContestId, selectedStudentId, {
        status,
        reviewNote: batchNote
      });
      toast.success(
        status === 'confirmed_cheating'
          ? (en ? 'Student disqualified and cheating confirmed' : 'শিক্ষার্থীকে বহিষ্কার ও অসদুপায় নিশ্চিত করা হয়েছে')
          : (en ? 'All flags dismissed for this student' : 'শিক্ষার্থীর সকল ফ্ল্যাগ বাতিল করা হয়েছে')
      );
      // Update local state
      setViolations((prev) =>
        prev.map((v) => {
          if (!v) return v;
          const vContest = String(v.contestId?._id || v.contestId);
          const vStudent = String(v.studentId?._id || v.studentId);
          if (vContest === String(selectedContestId) && vStudent === String(selectedStudentId)) {
            return { ...v, status, reviewNote: batchNote || v.reviewNote };
          }
          return v;
        })
      );
      setBatchNote('');
    } catch (err) {
      toast.error(err?.message || (en ? 'Batch review failed' : 'ব্যাচ পর্যালোচনা ব্যর্থ হয়েছে'));
    } finally {
      setReviewing(false);
    }
  };

  // Active snapshot for lightbox
  const currentLightboxSnapshot =
    lightboxIndex !== null && activeStudentSnapshots[lightboxIndex]
      ? activeStudentSnapshots[lightboxIndex]
      : null;

  return (
    <div className="pv-layout">
      <Sidebar activeTab="cheating-verify" user={user} />

      <main className="pv-workspace">
        {/* Top Header & Breadcrumb Bar */}
        <header className="pv-header">
          <div className="pv-header__top">
            <div className="pv-header__meta">
              <nav className="pv-breadcrumbs" aria-label={en ? 'Audit navigation' : 'অডিট নেভিগেশন'}>
              <button
                type="button"
                className={`pv-breadcrumb-item ${!selectedContestId ? 'is-active' : ''}`}
                onClick={() => {
                  setSelectedContestId(null);
                  setSelectedStudentId(null);
                  setLightboxIndex(null);
                }}
              >
                <HiShieldExclamation size={16} />
                <span>{en ? 'All Contests' : 'সকল কনটেস্ট'}</span>
              </button>

              {activeContest && (
                <>
                  <span className="pv-breadcrumb-sep">/</span>
                  <button
                    type="button"
                    className={`pv-breadcrumb-item ${selectedContestId && !selectedStudentId ? 'is-active' : ''}`}
                    onClick={() => {
                      setSelectedStudentId(null);
                      setLightboxIndex(null);
                    }}
                  >
                    <span>{activeContest.name || (en ? 'Contest' : 'কনটেস্ট')}</span>
                  </button>
                </>
              )}

              {activeStudent && (
                <>
                  <span className="pv-breadcrumb-sep">/</span>
                  <span className="pv-breadcrumb-item is-active">
                    <span>{activeStudent.name || (en ? 'Candidate' : 'শিক্ষার্থী')}</span>
                  </span>
                </>
              )}
              </nav>

              <h1 className="pv-title">
                {!selectedContestId
                  ? (en ? 'Proctor Audit & Verification' : 'চিটিং যাচাই ও প্রক্টরিং নিরীক্ষা')
                  : !selectedStudentId
                  ? activeContest?.name || (en ? 'Contest Overview' : 'কনটেস্ট বিবরণ')
                  : (en ? `Evidence Dossier: ${activeStudent?.name || 'Candidate'}` : `প্রমাণ নথি: ${activeStudent?.name || 'শিক্ষার্থী'}`)}
              </h1>
              <p className="pv-subtitle">
                {!selectedContestId
                  ? (en
                      ? 'Review automated AI detections across your created contests. Select a queue below to narrow the case list.'
                      : 'আপনার তৈরি কনটেস্টে এআই প্রক্টর দ্বারা শনাক্তকৃত অসদুপায় পর্যালোচনা করুন। কেস তালিকা ছোট করতে নিচের একটি কিউ বেছে নিন।')
                  : !selectedStudentId
                  ? (en
                      ? 'Candidates flagged for mobile phone presence during this exam. Select a student to examine snapshots.'
                      : 'এই পরীক্ষায় মোবাইল ফোন ব্যবহারের সন্দেহে চিহ্নিত শিক্ষার্থী তালিকা। প্রমাণ দেখতে শিক্ষার্থীর নামের উপর ক্লিক করুন।')
                  : (en
                      ? 'Timestamped snapshots and AI confidence metrics recorded during the examination session.'
                      : 'পরীক্ষা চলাকালীন এআই ক্যামেরা দ্বারা ধারণকৃত সময়চিহ্নিত স্ক্রিনশট ও প্রমাণসমূহ।')}
              </p>
            </div>

            <div className="pv-header__actions">
              {selectedStudentId ? (
                <button
                  type="button"
                  className="pv-btn pv-btn--outline"
                  onClick={() => setSelectedStudentId(null)}
                >
                  <HiArrowLeft size={16} />
                  <span>{en ? 'Back to Candidates' : 'শিক্ষার্থী তালিকায় ফিরুন'}</span>
                </button>
              ) : selectedContestId ? (
                <button
                  type="button"
                  className="pv-btn pv-btn--outline"
                  onClick={() => setSelectedContestId(null)}
                >
                  <HiArrowLeft size={16} />
                  <span>{en ? 'All Contests' : 'সকল কনটেস্ট'}</span>
                </button>
              ) : null}

              <button
                type="button"
                className="pv-btn pv-btn--outline pv-refresh-btn"
                onClick={loadData}
                disabled={loading}
                aria-label={en ? 'Refresh proctoring records' : 'প্রক্টরিং রেকর্ড রিফ্রেশ করুন'}
              >
                <HiRefresh size={16} className={loading ? 'pv-spin' : ''} />
                <span>{en ? 'Refresh' : 'রিফ্রেশ'}</span>
              </button>
            </div>
          </div>

          {!selectedContestId && (
            <section className="pv-review-index" aria-labelledby="pv-review-index-title">
              <div className="pv-review-index__intro">
                <span className="pv-review-index__eyebrow">{en ? 'Review index' : 'পর্যালোচনা সূচি'}</span>
                <h2 id="pv-review-index-title">
                  {en ? 'Choose a queue' : 'একটি কিউ বেছে নিন'}
                </h2>
              </div>

              <div className="pv-metrics">
                <button
                  type="button"
                  className={`pv-metric-card pv-metric-card--managed ${contestStatusFilter === 'all' ? 'is-active' : ''}`}
                  onClick={() => setContestStatusFilter('all')}
                  aria-pressed={contestStatusFilter === 'all'}
                >
                  <span className="pv-metric-icon" aria-hidden="true"><HiAcademicCap size={18} /></span>
                  <span className="pv-metric-copy">
                    <span className="pv-metric-value">{summary.totalContests}</span>
                    <span className="pv-metric-label">{en ? 'Managed Contests' : 'পরিচালিত কনটেস্ট'}</span>
                  </span>
                </button>

                <button
                  type="button"
                  className={`pv-metric-card pv-metric-card--pending ${contestStatusFilter === 'action_required' ? 'is-active' : ''}`}
                  onClick={() => setContestStatusFilter('action_required')}
                  aria-pressed={contestStatusFilter === 'action_required'}
                >
                  <span className="pv-metric-icon" aria-hidden="true"><HiClock size={18} /></span>
                  <span className="pv-metric-copy">
                    <span className="pv-metric-value">{summary.pending}</span>
                    <span className="pv-metric-label">{en ? 'Pending Reviews' : 'পর্যালোচনার অপেক্ষায়'}</span>
                  </span>
                </button>

                <button
                  type="button"
                  className={`pv-metric-card pv-metric-card--flagged ${contestStatusFilter === 'has_flags' ? 'is-active' : ''}`}
                  onClick={() => setContestStatusFilter('has_flags')}
                  aria-pressed={contestStatusFilter === 'has_flags'}
                >
                  <span className="pv-metric-icon" aria-hidden="true"><HiUserGroup size={18} /></span>
                  <span className="pv-metric-copy">
                    <span className="pv-metric-value">{summary.flaggedStudents}</span>
                    <span className="pv-metric-label">{en ? 'Flagged Candidates' : 'চিহ্নিত শিক্ষার্থী'}</span>
                  </span>
                </button>

                <button
                  type="button"
                  className={`pv-metric-card pv-metric-card--confirmed ${contestStatusFilter === 'disqualified' ? 'is-active' : ''}`}
                  onClick={() => setContestStatusFilter('disqualified')}
                  aria-pressed={contestStatusFilter === 'disqualified'}
                >
                  <span className="pv-metric-icon" aria-hidden="true"><HiBan size={18} /></span>
                  <span className="pv-metric-copy">
                    <span className="pv-metric-value">{summary.confirmed}</span>
                    <span className="pv-metric-label">{en ? 'Disqualified' : 'নিশ্চিত অসদুপায়'}</span>
                  </span>
                </button>
              </div>
            </section>
          )}
        </header>

        {/* =========================================================================
            TIER 1: CONTESTS OVERVIEW
            ========================================================================= */}
        {!selectedContestId && (
          <div className="pv-tier-view">
            {/* Contest Filter Toolbar */}
            <div className="pv-toolbar">
              <div className="pv-search-box">
                <HiSearch size={18} className="pv-search-icon" />
                <input
                  type="text"
                  name="contestSearch"
                  autoComplete="off"
                  aria-label={en ? 'Search contests by title' : 'কনটেস্ট শিরোনাম দিয়ে খুঁজুন'}
                  placeholder={en ? 'Search contests by title…' : 'কনটেস্ট শিরোনাম দিয়ে খুঁজুন…'}
                  value={contestSearch}
                  onChange={(e) => setContestSearch(e.target.value)}
                />
                {contestSearch && (
                  <button
                    type="button"
                    className="pv-clear-btn"
                    onClick={() => setContestSearch('')}
                    aria-label={en ? 'Clear contest search' : 'কনটেস্ট অনুসন্ধান মুছুন'}
                  >
                    <HiX size={14} />
                  </button>
                )}
              </div>

              <div className="pv-filter-group" role="group" aria-label={en ? 'Filter contests' : 'কনটেস্ট ফিল্টার করুন'}>
                <HiFilter size={16} className="pv-filter-icon" />
                <button
                  type="button"
                  className={`pv-pill ${contestStatusFilter === 'all' ? 'is-active' : ''}`}
                  onClick={() => setContestStatusFilter('all')}
                >
                  {en ? 'All Contests' : 'সকল কনটেস্ট'}
                </button>
                <button
                  type="button"
                  className={`pv-pill ${contestStatusFilter === 'action_required' ? 'is-active' : ''}`}
                  onClick={() => setContestStatusFilter('action_required')}
                >
                  {en ? 'Action Required' : 'পর্যালোচনা প্রয়োজন'}
                </button>
                <button
                  type="button"
                  className={`pv-pill ${contestStatusFilter === 'has_flags' ? 'is-active' : ''}`}
                  onClick={() => setContestStatusFilter('has_flags')}
                >
                  {en ? 'Flagged Only' : 'ফ্ল্যাগযুক্ত'}
                </button>
                <button
                  type="button"
                  className={`pv-pill ${contestStatusFilter === 'clean' ? 'is-active' : ''}`}
                  onClick={() => setContestStatusFilter('clean')}
                >
                  {en ? 'Clean' : 'ত্রুটিমুক্ত'}
                </button>
                <button
                  type="button"
                  className={`pv-pill ${contestStatusFilter === 'disqualified' ? 'is-active' : ''}`}
                  onClick={() => setContestStatusFilter('disqualified')}
                >
                  {en ? 'Disqualified' : 'বহিষ্কৃত'}
                </button>
              </div>
            </div>

            {/* Contests Grid */}
            {loading ? (
              <div className="pv-state-box">
                <div className="pv-spinner" />
                <p>{en ? 'Loading contest audit records...' : 'কনটেস্ট রেকর্ড লোড হচ্ছে...'}</p>
              </div>
            ) : error ? (
              <div className="pv-state-box pv-state-box--error">
                <HiExclamationCircle size={36} />
                <p>{error}</p>
                <button type="button" className="pv-btn pv-btn--primary" onClick={loadData}>
                  {en ? 'Try Again' : 'আবার চেষ্টা করুন'}
                </button>
              </div>
            ) : filteredContests.length === 0 ? (
              <div className="pv-state-box">
                <HiShieldCheck size={40} />
                <h3>{en ? 'No matching contests found' : 'কোনো কনটেস্ট পাওয়া যায়নি'}</h3>
                <p>{en ? 'Try adjusting your search criteria or filter options.' : 'অনুসন্ধানের ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।'}</p>
              </div>
            ) : (
              <div className="pv-contest-grid">
                {filteredContests.map((c) => {
                  if (!c) return null;
                  const cStats = computedContestStats[String(c._id)] || c.stats || {};
                  const flaggedStudentsCount = cStats.flaggedStudentsSet
                    ? cStats.flaggedStudentsSet.size
                    : (c.stats?.flaggedStudentsCount || 0);
                  const totalViolationsCount = cStats.totalViolations ?? (c.stats?.totalViolations || 0);
                  const pendingReviewsCount = cStats.pendingCount ?? (c.stats?.pendingCount || 0);
                  const confirmedCount = cStats.confirmedCount ?? (c.stats?.confirmedCount || 0);

                  const hasPending = pendingReviewsCount > 0;
                  const hasFlags = totalViolationsCount > 0;

                  return (
                    <article
                      key={c._id}
                      className={`pv-contest-card ${hasPending ? 'has-pending' : ''}`}
                    >
                      <button
                        type="button"
                        className="pv-card-hit-area"
                        aria-label={
                          en
                            ? `Inspect ${c.name || 'contest'}${pendingReviewsCount ? `, ${pendingReviewsCount} pending` : ''}`
                            : `${c.name || 'কনটেস্ট'} পর্যালোচনা করুন`
                        }
                        onClick={() => {
                          setSelectedContestId(String(c._id));
                          setSelectedStudentId(null);
                        }}
                      />
                      {/* Top Badges & Overall Status */}
                      <div className="pv-contest-card__head">
                        <div className="pv-contest-card__tags">
                          <span className="pv-tag pv-tag--level">{typeof c.level === 'string' ? c.level.toUpperCase() : 'EXAM'}</span>
                          {c.admissionType && (
                            <span className="pv-tag pv-tag--stream">{String(c.admissionType)}</span>
                          )}
                        </div>
                        <span
                          className={`pv-status-pill ${
                            hasPending
                              ? 'pv-status-pill--pending'
                              : hasFlags
                              ? 'pv-status-pill--resolved'
                              : 'pv-status-pill--clean'
                          }`}
                        >
                          {hasPending
                            ? en ? `${pendingReviewsCount} Pending` : `${pendingReviewsCount}টি অপেক্ষমাণ`
                            : hasFlags
                            ? en ? 'Resolved' : 'পর্যালোচিত'
                            : en ? 'No Violations' : 'কোনো ফ্ল্যাগ নেই'}
                        </span>
                      </div>

                      {/* Contest Title */}
                      <h3 className="pv-contest-card__title">{c.name || (en ? 'Untitled Contest' : 'নামবিহীন কনটেস্ট')}</h3>

                      {/* Exam Schedule & Time */}
                      <div className="pv-contest-card__meta">
                        {c.date && (
                          <div className="pv-contest-meta-item">
                            <HiCalendar size={15} />
                            <span>{formatShortDate(c.date)}</span>
                          </div>
                        )}
                        {c.duration && (
                          <div className="pv-contest-meta-item">
                            <HiClock size={15} />
                            <span>{c.duration?.hours || 0}h {c.duration?.minutes || 0}m</span>
                          </div>
                        )}
                      </div>

                      {/* Prominent Flagged Students Alert Banner */}
                      <div
                        className={`pv-contest-flag-alert ${
                          flaggedStudentsCount > 0
                            ? hasPending
                              ? 'is-pending'
                              : 'is-resolved'
                            : 'is-clean'
                        }`}
                      >
                        <div className="pv-contest-flag-alert__main">
                          <HiUserGroup size={18} className="pv-flag-icon" />
                          <div>
                            <div className="pv-contest-flag-count">
                              {flaggedStudentsCount}{' '}
                              <span>
                                {en
                                  ? flaggedStudentsCount === 1 ? 'Student Flagged' : 'Students Flagged'
                                  : 'জন শিক্ষার্থী চিহ্নিত'}
                              </span>
                            </div>
                            <div className="pv-contest-flag-sub">
                              {flaggedStudentsCount > 0
                                ? (en ? 'Mobile phone presence detected' : 'মোবাইল ফোন শনাক্তকরণ রেকর্ড করা হয়েছে')
                                : (en ? 'Clean proctor audit session' : 'কোনো অসদুপায় শনাক্ত হয়নি')}
                            </div>
                          </div>
                        </div>
                        {hasPending && (
                          <span className="pv-action-needed-badge">
                            {en ? `${pendingReviewsCount} Needs Action` : `${pendingReviewsCount}টি পর্যালোচনা প্রয়োজন`}
                          </span>
                        )}
                      </div>

                      {/* Numeric Stats Breakdown */}
                      <div className="pv-contest-card__stats">
                        <div className="pv-contest-stat-item">
                          <span className="pv-contest-stat-val">{flaggedStudentsCount}</span>
                          <span className="pv-contest-stat-lbl">{en ? 'Flagged Students' : 'চিহ্নিত শিক্ষার্থী'}</span>
                        </div>
                        <div className="pv-contest-stat-item">
                          <span className="pv-contest-stat-val">{totalViolationsCount}</span>
                          <span className="pv-contest-stat-lbl">{en ? 'Total Detections' : 'মোট শনাক্তকরণ'}</span>
                        </div>
                        <div className="pv-contest-stat-item">
                          <span className="pv-contest-stat-val">{confirmedCount}</span>
                          <span className="pv-contest-stat-lbl">{en ? 'Disqualified' : 'বহিষ্কৃত'}</span>
                        </div>
                      </div>

                      {/* Card Footer CTA */}
                      <div className="pv-contest-card__footer">
                        <span className="pv-contest-cta">
                          <span>
                            {flaggedStudentsCount > 0
                              ? (en ? `Inspect ${flaggedStudentsCount} Flagged ${flaggedStudentsCount === 1 ? 'Candidate' : 'Candidates'}` : `চিহ্নিত ${flaggedStudentsCount} জন শিক্ষার্থী দেখুন`)
                              : (en ? 'View Contest Roster' : 'কনটেস্ট তালিকা দেখুন')}
                          </span>
                          <HiArrowRight size={15} />
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TIER 2: FLAGGED STUDENTS ROSTER (IN SELECTED CONTEST)
            ========================================================================= */}
        {selectedContestId && !selectedStudentId && (
          <div className="pv-tier-view">
            {/* Contest Info Header Banner */}
            <div className="pv-banner">
              <div className="pv-banner__info">
                <div className="pv-banner__eyebrow">
                  <HiAcademicCap size={16} />
                  <span>{en ? 'Contest Audit Session' : 'কনটেস্ট অডিট সেশন'}</span>
                </div>
                <h2>{activeContest?.name || (en ? 'Contest Roster' : 'কনটেস্ট রোস্টার')}</h2>
                <div className="pv-banner__sub">
                  <span>{en ? 'Date' : 'তারিখ'}: {formatShortDate(activeContest?.date)}</span>
                  <span>•</span>
                  <span>{en ? 'Duration' : 'সময়কাল'}: {activeContest?.duration?.hours || 0}h {activeContest?.duration?.minutes || 0}m</span>
                  <span>•</span>
                  <span>
                    <strong className="pv-highlight-num">{flaggedStudentsInContest.length}</strong>{' '}
                    {en ? 'students flagged for mobile phone' : 'জন শিক্ষার্থী মোবাইল ফোনের জন্য চিহ্নিত'}
                  </span>
                </div>
              </div>
            </div>

            {/* Student Filter Toolbar */}
            <div className="pv-toolbar">
              <div className="pv-search-box">
                <HiSearch size={18} className="pv-search-icon" />
                <input
                  type="text"
                  name="studentSearch"
                  autoComplete="off"
                  aria-label={en ? 'Search candidates by name or email' : 'নাম বা ইমেইল দিয়ে শিক্ষার্থী খুঁজুন'}
                  placeholder={en ? 'Search candidate by name or email…' : 'নাম বা ইমেইল দিয়ে শিক্ষার্থী খুঁজুন…'}
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
                {studentSearch && (
                  <button
                    type="button"
                    className="pv-clear-btn"
                    onClick={() => setStudentSearch('')}
                    aria-label={en ? 'Clear candidate search' : 'শিক্ষার্থী অনুসন্ধান মুছুন'}
                  >
                    <HiX size={14} />
                  </button>
                )}
              </div>

              <div className="pv-filter-group" role="group" aria-label={en ? 'Filter candidates' : 'শিক্ষার্থী ফিল্টার করুন'}>
                <button
                  type="button"
                  className={`pv-pill ${studentStatusFilter === 'all' ? 'is-active' : ''}`}
                  onClick={() => setStudentStatusFilter('all')}
                >
                  {en ? 'All Candidates' : 'সকল শিক্ষার্থী'} ({flaggedStudentsInContest.length})
                </button>
                <button
                  type="button"
                  className={`pv-pill ${studentStatusFilter === 'pending' ? 'is-active' : ''}`}
                  onClick={() => setStudentStatusFilter('pending')}
                >
                  {en ? 'Pending Review' : 'অপেক্ষমাণ'}
                </button>
                <button
                  type="button"
                  className={`pv-pill ${studentStatusFilter === 'confirmed' ? 'is-active' : ''}`}
                  onClick={() => setStudentStatusFilter('confirmed')}
                >
                  {en ? 'Confirmed' : 'নিশ্চিত অসদুপায়'}
                </button>
                <button
                  type="button"
                  className={`pv-pill ${studentStatusFilter === 'dismissed' ? 'is-active' : ''}`}
                  onClick={() => setStudentStatusFilter('dismissed')}
                >
                  {en ? 'Dismissed' : 'বাতিল'}
                </button>
              </div>
            </div>

            {/* Students Grid */}
            {filteredStudents.length === 0 ? (
              <div className="pv-state-box">
                <HiShieldCheck size={40} />
                <h3>{en ? 'No flagged candidates found' : 'কোনো চিহ্নিত শিক্ষার্থী পাওয়া যায়নি'}</h3>
                <p>
                  {en
                    ? 'No candidates triggered mobile phone detections matching your current filter.'
                    : 'বর্তমান ফিল্টারের সাথে কোনো শিক্ষার্থী অসদুপায় শনাক্তকরণ তালিকায় নেই।'}
                </p>
                <button
                  type="button"
                  className="pv-btn pv-btn--outline"
                  onClick={() => setSelectedContestId(null)}
                >
                  <HiArrowLeft size={16} />
                  <span>{en ? 'Back to All Contests' : 'সকল কনটেস্টে ফিরে যান'}</span>
                </button>
              </div>
            ) : (
              <div className="pv-student-grid">
                {filteredStudents.map((s) => {
                  if (!s) return null;
                  const meta = STATUS_META[s.overallStatus] || STATUS_META.pending_review;
                  const hasPending = s.pendingCount > 0;
                  const initials = String(s.name || 'ST').trim().slice(0, 2).toUpperCase() || 'ST';

                  return (
                    <article
                      key={s.id}
                      className={`pv-student-card ${hasPending ? 'has-pending' : ''}`}
                    >
                      <button
                        type="button"
                        className="pv-card-hit-area"
                        aria-label={en ? `Review evidence for ${s.name || 'candidate'}` : `${s.name || 'শিক্ষার্থী'}-এর প্রমাণ পর্যালোচনা করুন`}
                        onClick={() => setSelectedStudentId(s.id)}
                      />
                      <div className="pv-student-card__head">
                        <div className="pv-student-avatar">
                          {s.avatar ? (
                            <img
                              src={s.avatar}
                              alt={s.name || 'Candidate'}
                              width="44"
                              height="44"
                              loading="lazy"
                            />
                          ) : (
                            <div className="pv-avatar-initials">{initials}</div>
                          )}
                        </div>

                        <div className="pv-student-card__id">
                          <h4 className="pv-student-name">{s.name || (en ? 'Candidate' : 'শিক্ষার্থী')}</h4>
                          <span className="pv-student-email">{s.email || '—'}</span>
                        </div>

                        <span className={`pv-badge pv-badge--${meta.cls}`}>
                          {en ? meta.badgeTextEn : meta.badgeTextBn}
                        </span>
                      </div>

                      <div className="pv-student-card__stats">
                        <div className="pv-stat-row">
                          <span className="pv-stat-label">{en ? 'Snapshots' : 'স্ক্রিনশট'}:</span>
                          <span className="pv-stat-value pv-mono">{(s.violations || []).length} {en ? 'detected' : 'টি'}</span>
                        </div>
                        <div className="pv-stat-row">
                          <span className="pv-stat-label">{en ? 'Max AI Confidence' : 'সর্বোচ্চ নির্ভুলতা'}:</span>
                          <span className="pv-stat-value pv-mono">{s.maxConfidence || 0}%</span>
                        </div>
                        <div className="pv-stat-row">
                          <span className="pv-stat-label">{en ? 'Latest Alert' : 'সর্বশেষ শনাক্ত'}:</span>
                          <span className="pv-stat-value pv-mono">{formatTimestamp(s.latestTimestamp)}</span>
                        </div>
                      </div>

                      <div className="pv-student-card__footer">
                        <span className="pv-cta-link">
                          <HiEye size={16} />
                          <span>{en ? 'Review Visual Evidence' : 'প্রমাণ ছবি পর্যালোচনা করুন'}</span>
                          <HiChevronRight size={15} />
                        </span>
                        <button
                          type="button"
                          className="pv-btn-delete-card"
                          aria-label={
                            en
                              ? `Delete screenshots for ${s.name || 'candidate'}`
                              : `${s.name || 'শিক্ষার্থী'}-এর স্ক্রিনশট মুছুন`
                          }
                          title={
                            en
                              ? 'Remove cheater student screenshot records from database'
                              : 'ডাটাবেজ থেকে অসদুপায় স্ক্রিনশট ও রেকর্ড মুছুন'
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({
                              type: 'student',
                              contestId: selectedContestId,
                              studentId: s.id,
                              studentName: s.name,
                              count: (s.violations || []).length
                            });
                          }}
                        >
                          <HiTrash size={15} />
                          <span>{en ? 'Delete' : 'মুছুন'}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TIER 3: EVIDENCE DOSSIER & VERIFICATION (SELECTED CANDIDATE)
            ========================================================================= */}
        {selectedContestId && selectedStudentId && activeStudent && (
          <div className="pv-tier-view">
            {/* Candidate Summary Dossier Header */}
            <div className="pv-dossier-header">
              <div className="pv-dossier-profile">
                <div className="pv-student-avatar pv-student-avatar--lg">
                  {activeStudent.avatar ? (
                    <img
                      src={activeStudent.avatar}
                      alt={activeStudent.name || 'Candidate'}
                      width="56"
                      height="56"
                    />
                  ) : (
                    <div className="pv-avatar-initials pv-avatar-initials--lg">
                      {String(activeStudent.name || 'ST').trim().slice(0, 2).toUpperCase() || 'ST'}
                    </div>
                  )}
                </div>
                <div>
                  <div className="pv-dossier-meta-tags">
                    <span className="pv-tag pv-tag--contest">{activeContest?.name || (en ? 'Contest' : 'কনটেস্ট')}</span>
                    <span
                      className={`pv-badge pv-badge--${
                        STATUS_META[activeStudent.overallStatus]?.cls || 'pending'
                      }`}
                    >
                      {en
                        ? STATUS_META[activeStudent.overallStatus]?.labelEn
                        : STATUS_META[activeStudent.overallStatus]?.labelBn}
                    </span>
                  </div>
                  <h2 className="pv-dossier-name">{activeStudent.name || (en ? 'Candidate' : 'শিক্ষার্থী')}</h2>
                  <p className="pv-dossier-sub">{activeStudent.email || '—'}</p>
                </div>
              </div>

              {/* Batch Actions Box */}
              <div className="pv-batch-box">
                <div className="pv-batch-note">
                  <input
                    type="text"
                    name="batchReviewNote"
                    autoComplete="off"
                    aria-label={en ? 'Audit comment or note' : 'পর্যালোচনা মন্তব্য'}
                    placeholder={en ? 'Audit comment or note (optional)…' : 'পর্যালোচনা মন্তব্য (ঐচ্ছিক)…'}
                    value={batchNote}
                    onChange={(e) => setBatchNote(e.target.value)}
                  />
                </div>
                <div className="pv-batch-buttons">
                  <button
                    type="button"
                    className="pv-btn pv-btn--dismiss"
                    onClick={() => handleBatchReviewStudent('dismissed_false_positive')}
                    disabled={reviewing || deleting}
                  >
                    <HiCheckCircle size={17} />
                    <span>{en ? 'Dismiss All (False Alarm)' : 'সব বাতিল করুন'}</span>
                  </button>
                  <button
                    type="button"
                    className="pv-btn pv-btn--danger"
                    onClick={() => handleBatchReviewStudent('confirmed_cheating')}
                    disabled={reviewing || deleting}
                  >
                    <HiBan size={17} />
                    <span>{en ? 'Confirm Cheating (Disqualify)' : 'বহিষ্কার ও অসদুপায় নিশ্চিত'}</span>
                  </button>
                  <button
                    type="button"
                    className="pv-btn pv-btn--delete"
                    onClick={() =>
                      setDeleteTarget({
                        type: 'student',
                        contestId: selectedContestId,
                        studentId: activeStudent.id,
                        studentName: activeStudent.name,
                        count: activeStudentSnapshots.length
                      })
                    }
                    disabled={reviewing || deleting}
                    title={
                      en
                        ? 'Delete all screenshots for this student from database'
                        : 'ডাটাবেজ থেকে এই শিক্ষার্থীর সব স্ক্রিনশট মুছুন'
                    }
                  >
                    <HiTrash size={17} />
                    <span>{en ? 'Delete Records' : 'রেকর্ড মুছুন'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Evidence Gallery Grid */}
            <div className="pv-gallery-header">
              <h3>
                <HiPhotograph size={20} />
                <span>
                  {en ? 'Captured Mobile Phone Snapshots' : 'ধারণকৃত মোবাইল ফোন স্ক্রিনশটসমূহ'} ({activeStudentSnapshots.length})
                </span>
              </h3>
              <span className="pv-gallery-hint">
                {en ? 'Click any snapshot to inspect in high-resolution' : 'হাই-রেজোলিউশনে দেখতে যেকোনো ছবিতে ক্লিক করুন'}
              </span>
            </div>

            <div className="pv-snapshot-grid">
              {activeStudentSnapshots.map((snap, idx) => {
                if (!snap) return null;
                const meta = STATUS_META[snap.status] || STATUS_META.pending_review;

                return (
                  <div key={snap._id || idx} className="pv-snapshot-card">
                    <button
                      type="button"
                      className="pv-snapshot-card__image-wrap"
                      onClick={() => setLightboxIndex(idx)}
                      aria-label={en ? `Inspect evidence snapshot ${idx + 1}` : `প্রমাণের ছবি ${idx + 1} দেখুন`}
                    >
                      {isRenderableSnapshot(snap.snapshotUrl) ? (
                        <img
                          src={snap.snapshotUrl}
                          alt={en ? 'Captured evidence' : 'প্রমাণ ছবি'}
                          width="640"
                          height="480"
                          loading="lazy"
                        />
                      ) : (
                        <span className="pv-snapshot-missing">
                          <HiPhotograph size={30} />
                          <span>{en ? 'Preview unavailable' : 'প্রিভিউ নেই'}</span>
                        </span>
                      )}
                      <span className="pv-detection-tag">
                        {(snap.violationType || 'MOBILE_PHONE_DETECTED').replace(/_/g, ' ')}
                      </span>
                      {typeof snap.confidence === 'number' && (
                        <span className="pv-confidence-tag">{snap.confidence}%</span>
                      )}
                      <span className="pv-zoom-overlay">
                        <HiEye size={22} />
                        <span>{en ? 'Click to inspect' : 'দেখতে ক্লিক করুন'}</span>
                      </span>
                    </button>

                    <div className="pv-snapshot-card__body">
                      <div className="pv-snapshot-row">
                        <span className="pv-snapshot-label">{en ? 'Timestamp' : 'সময়'}:</span>
                        <span className="pv-snapshot-val pv-mono">
                          {formatTimestamp(snap.timestamp || snap.createdAt)}
                        </span>
                      </div>
                      {typeof snap.questionIndex === 'number' && (
                        <div className="pv-snapshot-row">
                          <span className="pv-snapshot-label">{en ? 'Question' : 'প্রশ্ন'}:</span>
                          <span className="pv-snapshot-val">
                            {en ? `Question #${snap.questionIndex + 1}` : `প্রশ্ন #${snap.questionIndex + 1}`}
                          </span>
                        </div>
                      )}
                      <div className="pv-snapshot-row">
                        <span className="pv-snapshot-label">{en ? 'Status' : 'অবস্থা'}:</span>
                        <span className={`pv-badge pv-badge--${meta.cls}`}>
                          {en ? meta.labelEn : meta.labelBn}
                        </span>
                      </div>

                      {snap.reviewNote && (
                        <div className="pv-snapshot-note-display">
                          <span>{en ? 'Note' : 'নোট'}:</span> {snap.reviewNote}
                        </div>
                      )}

                      {/* Individual Review Actions */}
                      <div className="pv-snapshot-card__actions">
                        <button
                          type="button"
                          className="pv-btn pv-btn--sm pv-btn--dismiss"
                          onClick={() => handleReviewSingle(snap._id, 'dismissed_false_positive')}
                          disabled={reviewing || deleting}
                        >
                          <HiCheckCircle size={15} />
                          <span>{en ? 'Dismiss' : 'বাতিল'}</span>
                        </button>
                        <button
                          type="button"
                          className="pv-btn pv-btn--sm pv-btn--danger"
                          onClick={() => handleReviewSingle(snap._id, 'confirmed_cheating')}
                          disabled={reviewing || deleting}
                        >
                          <HiBan size={15} />
                          <span>{en ? 'Confirm' : 'নিশ্চিত'}</span>
                        </button>
                        <button
                          type="button"
                          className="pv-btn pv-btn--sm pv-btn--delete"
                          onClick={() =>
                            setDeleteTarget({
                              type: 'single',
                              violationId: snap._id,
                              studentName: activeStudent.name
                            })
                          }
                          disabled={reviewing || deleting}
                          title={
                            en
                              ? 'Delete this screenshot from database'
                              : 'ডাটাবেজ থেকে এই স্ক্রিনশট মুছুন'
                          }
                        >
                          <HiTrash size={15} />
                          <span>{en ? 'Delete' : 'মুছুন'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* =========================================================================
          HIGH-RESOLUTION LIGHTBOX INSPECTOR MODAL
          ========================================================================= */}
      {currentLightboxSnapshot && activeStudent && (
        <div
          className="pv-lightbox"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pv-lightbox-title"
          onClick={() => setLightboxIndex(null)}
        >
          <div className="pv-lightbox__panel" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="pv-lightbox__close"
              onClick={() => setLightboxIndex(null)}
              aria-label={en ? 'Close inspector' : 'বন্ধ করুন'}
            >
              <HiX size={20} />
            </button>

            {/* Left/Right Navigation Buttons */}
            {activeStudentSnapshots.length > 1 && (
              <>
                <button
                  type="button"
                  className="pv-lightbox__nav pv-lightbox__nav--prev"
                  disabled={lightboxIndex === 0}
                  onClick={() => setLightboxIndex((i) => Math.max(0, i - 1))}
                  aria-label={en ? 'Previous snapshot' : 'পূর্ববর্তী ছবি'}
                >
                  <HiChevronLeft size={24} />
                </button>
                <button
                  type="button"
                  className="pv-lightbox__nav pv-lightbox__nav--next"
                  disabled={lightboxIndex >= activeStudentSnapshots.length - 1}
                  onClick={() =>
                    setLightboxIndex((i) => Math.min(activeStudentSnapshots.length - 1, i + 1))
                  }
                  aria-label={en ? 'Next snapshot' : 'পরবর্তী ছবি'}
                >
                  <HiChevronRight size={24} />
                </button>
              </>
            )}

            {/* Image Preview Container */}
            <div className="pv-lightbox__image-box">
              {isRenderableSnapshot(currentLightboxSnapshot.snapshotUrl) ? (
                <img
                  src={currentLightboxSnapshot.snapshotUrl}
                  alt={en ? 'High resolution inspection' : 'উচ্চ রেজোলিউশন প্রমাণ ছবি'}
                  width="640"
                  height="480"
                />
              ) : (
                <div className="pv-snapshot-missing pv-snapshot-missing--lg">
                  <HiPhotograph size={48} />
                  <span>{en ? 'Image file unavailable' : 'ছবি পাওয়া যায়নি'}</span>
                </div>
              )}
              <div className="pv-lightbox__index-tag">
                {lightboxIndex + 1} / {activeStudentSnapshots.length}
              </div>
            </div>

            {/* Metadata & Decision Sidebar */}
            <div className="pv-lightbox__meta-panel">
              <div className="pv-lightbox__meta-head">
                <span
                  className={`pv-badge pv-badge--${
                    STATUS_META[currentLightboxSnapshot.status]?.cls || 'pending'
                  }`}
                >
                  {en
                    ? STATUS_META[currentLightboxSnapshot.status]?.labelEn
                    : STATUS_META[currentLightboxSnapshot.status]?.labelBn}
                </span>
                <h3 id="pv-lightbox-title">{en ? 'Audit Evidence Details' : 'প্রমাণ নিরীক্ষা তথ্য'}</h3>
              </div>

              <div className="pv-lightbox__details">
                <div className="pv-detail-item">
                  <span className="pv-detail-label">{en ? 'Candidate' : 'শিক্ষার্থী'}</span>
                  <span className="pv-detail-value">{activeStudent.name || 'Candidate'}</span>
                </div>
                <div className="pv-detail-item">
                  <span className="pv-detail-label">{en ? 'Contest' : 'কনটেস্ট'}</span>
                  <span className="pv-detail-value">{activeContest?.name || 'Contest'}</span>
                </div>
                <div className="pv-detail-item">
                  <span className="pv-detail-label">{en ? 'Detection Type' : 'শনাক্তকরণের ধরন'}</span>
                  <span className="pv-detail-value pv-mono">
                    {(currentLightboxSnapshot.violationType || 'MOBILE_PHONE_DETECTED').replace(
                      /_/g,
                      ' '
                    )}
                  </span>
                </div>
                <div className="pv-detail-item">
                  <span className="pv-detail-label">{en ? 'AI Confidence' : 'এআই নির্ভুলতা'}</span>
                  <span className="pv-detail-value pv-mono">
                    {typeof currentLightboxSnapshot.confidence === 'number'
                      ? `${currentLightboxSnapshot.confidence}%`
                      : '—'}
                  </span>
                </div>
                <div className="pv-detail-item">
                  <span className="pv-detail-label">{en ? 'Timestamp' : 'সময়'}</span>
                  <span className="pv-detail-value pv-mono">
                    {formatTimestamp(
                      currentLightboxSnapshot.timestamp || currentLightboxSnapshot.createdAt
                    )}
                  </span>
                </div>
              </div>

              <div className="pv-lightbox__note-section">
                <label className="pv-input-label">
                  <span>{en ? 'Review Decision Note' : 'পর্যালোচনা সিদ্ধান্ত মন্তব্য'}</span>
                  <textarea
                    name="reviewDecisionNote"
                    autoComplete="off"
                    rows={3}
                    placeholder={en ? 'Enter rationale for this decision…' : 'এই সিদ্ধান্তের কারণ লিখুন…'}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                  />
                </label>
              </div>

              <div className="pv-lightbox__action-bar">
                <button
                  type="button"
                  className="pv-btn pv-btn--dismiss"
                  disabled={reviewing || deleting}
                  onClick={() => {
                    handleReviewSingle(
                      currentLightboxSnapshot._id,
                      'dismissed_false_positive',
                      reviewNote
                    );
                    setReviewNote('');
                  }}
                >
                  <HiCheckCircle size={18} />
                  <span>{en ? 'Dismiss (False Positive)' : 'বাতিল (ভুল শনাক্ত)'}</span>
                </button>
                <button
                  type="button"
                  className="pv-btn pv-btn--danger"
                  disabled={reviewing || deleting}
                  onClick={() => {
                    handleReviewSingle(
                      currentLightboxSnapshot._id,
                      'confirmed_cheating',
                      reviewNote
                    );
                    setReviewNote('');
                  }}
                >
                  <HiBan size={18} />
                  <span>{en ? 'Confirm Cheating' : 'চিটিং নিশ্চিত করুন'}</span>
                </button>
                <button
                  type="button"
                  className="pv-btn pv-btn--delete"
                  disabled={reviewing || deleting}
                  onClick={() => {
                    setDeleteTarget({
                      type: 'single',
                      violationId: currentLightboxSnapshot._id,
                      studentName: activeStudent.name
                    });
                  }}
                  title={
                    en
                      ? 'Delete this screenshot from database'
                      : 'ডাটাবেজ থেকে এই স্ক্রিনশট মুছুন'
                  }
                >
                  <HiTrash size={18} />
                  <span>{en ? 'Delete Snapshot' : 'স্ক্রিনশট মুছুন'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CONFIRM DELETE MODAL
          ========================================================================= */}
      {deleteTarget && (
        <div
          className="pv-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pv-delete-modal-title"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="pv-confirm-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pv-confirm-head">
              <div className="pv-confirm-icon-wrap" aria-hidden="true">
                <HiTrash size={24} />
              </div>
              <div>
                <h3 id="pv-delete-modal-title">
                  {deleteTarget.type === 'student'
                    ? en
                      ? 'Delete Student Cheating Records'
                      : 'শিক্ষার্থীর চিটিং রেকর্ড মুছে ফেলুন'
                    : en
                    ? 'Delete Screenshot Record'
                    : 'স্ক্রিনশট রেকর্ড মুছে ফেলুন'}
                </h3>
                <p className="pv-confirm-subtitle">
                  {en ? 'Permanent database deletion' : 'ডাটাবেজ থেকে স্থায়ীভাবে মুছে ফেলা হবে'}
                </p>
              </div>
            </div>

            <div className="pv-confirm-body">
              {deleteTarget.type === 'student' ? (
                <p>
                  {en ? (
                    <>
                      Are you sure you want to delete all{' '}
                      <strong>{deleteTarget.count || 'all'}</strong> cheating snapshots and
                      violation records for{' '}
                      <strong>{deleteTarget.studentName || 'this student'}</strong> from the
                      database?
                    </>
                  ) : (
                    <>
                      আপনি কি নিশ্চিত যে{' '}
                      <strong>{deleteTarget.studentName || 'এই শিক্ষার্থী'}</strong>-এর{' '}
                      <strong>{deleteTarget.count || 'সকল'}</strong>টি চিটিং স্ক্রিনশট ও রেকর্ড
                      ডাটাবেজ থেকে মুছে ফেলতে চান?
                    </>
                  )}
                </p>
              ) : (
                <p>
                  {en ? (
                    <>
                      Are you sure you want to permanently delete this captured screenshot evidence
                      from the database?
                    </>
                  ) : (
                    <>
                      আপনি কি নিশ্চিত যে এই ধারণকৃত স্ক্রিনশট প্রমাণটি ডাটাবেজ থেকে স্থায়ীভাবে মুছে
                      ফেলতে চান?
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="pv-confirm-warning">
              <HiExclamationCircle size={18} />
              <span>
                {en
                  ? 'This action cannot be undone. The screenshots will be permanently removed.'
                  : 'এই কাজটি পুনরায় ফিরিয়ে আনা সম্ভব নয়। স্ক্রিনশটগুলো স্থায়ীভাবে মুছে যাবে।'}
              </span>
            </div>

            <div className="pv-confirm-actions">
              <button
                type="button"
                className="pv-btn pv-btn--outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                <span>{en ? 'Cancel' : 'বাতিল'}</span>
              </button>
              <button
                type="button"
                className="pv-btn pv-btn--danger"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                <HiTrash size={16} />
                <span>
                  {deleting
                    ? en
                      ? 'Deleting...'
                      : 'মুছে ফেলা হচ্ছে...'
                    : en
                    ? 'Delete from Database'
                    : 'ডাটাবেজ থেকে মুছুন'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

