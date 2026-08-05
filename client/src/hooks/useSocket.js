/**
 * useSocket — React hook that manages a single shared Socket.IO connection.
 *
 * Why a hook?
 *  - Keeps one connection alive for the lifetime of the app instead of one per
 *    component, reducing overhead and avoiding duplicate event handlers.
 *  - Provides a clean subscribe/unsubscribe pattern via the returned `on`
 *    helper so components can register event listeners without worrying about
 *    cleanup or stale references.
 *
 * Features:
 *  - Authenticates using the JWT stored in localStorage.
 *  - Auto-reconnects with exponential back-off (1s → 8s cap).
 *  - Exposes `on(event, handler)` and `emit(event, payload)` shorthands that
 *    safely no-op when the socket is not yet available.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

// Resolve the Socket.IO server URL from environment variables, falling back
// to the current origin in production or localhost in development.
const DEFAULT_URL = import.meta.env.VITE_SOCKET_URL
  || (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : (import.meta.env.PROD ? window.location.origin : 'http://localhost:5000'));

export default function useSocket() {
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  // Hold the raw socket instance in a ref so event helpers can access it
  // without being captured in stale closures.
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

    // Track connection state so consumers can react to online/offline changes.
    s.on('connect', () => {
      setSocket(s);
      setConnected(true);
    });
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => setConnected(false));

    // Teardown: remove all listeners and close the connection when the
    // component using this hook unmounts.
    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Subscribe to a socket event and return an unsubscribe function.
  // This mirrors React's useEffect cleanup pattern — call it directly inside
  // a useEffect to automatically clean up on re-render or unmount.
  const on = useCallback((event, handler) => {
    const s = socketRef.current;
    if (!s) return () => {};
    s.on(event, handler);
    return () => s.off(event, handler);
  }, []);

  // Emit an event to the server. No-op if the socket is not connected yet.
  const emit = useCallback((event, payload) => {
    const s = socketRef.current;
    if (!s) return;
    s.emit(event, payload);
  }, []);

  return { socket, connected, on, emit };
}
