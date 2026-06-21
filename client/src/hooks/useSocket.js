import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const DEFAULT_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : 'http://localhost:5000';

/**
 * useSocket — single shared Socket.IO connection per user.
 * - Authenticates with the JWT in localStorage.
 * - Auto-reconnects with exponential backoff.
 * - Exposes `.on(event, handler)` and `.off(event, handler)` shorthands.
 */
export default function useSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token') || '';
    const s = io(DEFAULT_URL, {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      timeout: 15000
    });
    socketRef.current = s;

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => setConnected(false));

    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  const on = useCallback((event, handler) => {
    const s = socketRef.current;
    if (!s) return () => {};
    s.on(event, handler);
    return () => s.off(event, handler);
  }, []);

  const emit = useCallback((event, payload) => {
    const s = socketRef.current;
    if (!s) return;
    s.emit(event, payload);
  }, []);

  return { socket: socketRef.current, connected, on, emit };
}