import { useEffect, useRef, useState } from 'react';
import { httpClient } from '../../services/httpClient';

const baseStyle = {
  position: 'fixed',
  top: '16px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 12000,
  width: 'min(92vw, 560px)',
  padding: '12px 16px',
  borderRadius: '14px',
  border: '1px solid rgba(0, 0, 0, 0.08)',
  boxShadow: '0 20px 45px rgba(0, 0, 0, 0.18)',
  backdropFilter: 'blur(10px)',
  fontSize: '0.95rem',
  fontWeight: 600,
  lineHeight: 1.4
};

const toneStyles = {
  waiting: {
    background: 'rgba(255, 248, 229, 0.96)',
    color: '#8a5a00'
  },
  error: {
    background: 'rgba(255, 237, 237, 0.97)',
    color: '#9f1d1d'
  }
};

export default function BackendStatusBanner() {
  const [banner, setBanner] = useState({ visible: false, tone: 'waiting', message: '' });
  const hideTimerRef = useRef(null);

  useEffect(() => {
    const clearHideTimer = () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const handleStatus = (event) => {
      const detail = event?.detail || {};
      const state = detail.state;

      clearHideTimer();

      if (state === 'waiting') {
        setBanner({
          visible: true,
          tone: 'waiting',
          message: detail.message || httpClient.BACKEND_WAITING_MESSAGE
        });
        return;
      }

      if (state === 'error') {
        setBanner({
          visible: true,
          tone: 'error',
          message: detail.message || httpClient.BACKEND_DELAYED_MESSAGE
        });
        hideTimerRef.current = window.setTimeout(() => {
          setBanner((current) => ({ ...current, visible: false }));
        }, 6000);
        return;
      }

      setBanner((current) => ({ ...current, visible: false }));
    };

    window.addEventListener(httpClient.BACKEND_STATUS_EVENT, handleStatus);
    return () => {
      clearHideTimer();
      window.removeEventListener(httpClient.BACKEND_STATUS_EVENT, handleStatus);
    };
  }, []);

  if (!banner.visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        ...baseStyle,
        ...(toneStyles[banner.tone] || toneStyles.waiting)
      }}
    >
      {banner.message}
    </div>
  );
}
