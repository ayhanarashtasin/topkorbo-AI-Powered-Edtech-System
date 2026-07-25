import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import forumApi from '../services/forumApi';
import useSocket from '../hooks/useSocket';

/**
 * ForumContext — central store for the entire Community feature.
 *
 * Mirrors the ergonomics of an RTK Query slice: it owns the user,
 * categories, notifications and unread-count state, exposes action
 * helpers (createPost, toggleReaction, follow, …) and accepts
 * `subscribeReaction` / `subscribeComment` callbacks for components that
 * need live updates. Socket.IO events keep state fresh across tabs in
 * real time.
 */

const ForumContext = createContext(null);

export function ForumProvider({ children }) {
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bootError, setBootError] = useState(null);
  const [bootDone, setBootDone] = useState(false);

  const { socket, connected, on } = useSocket();
  const unreadNotificationIdsRef = useRef(new Set());

  // ---- Boot: load user + categories + notifications ----
  const refreshUser = useCallback(async () => {
    try {
      const json = await forumApi.me();
      setUser(json.data);
      return json.data;
    } catch (e) {
      setBootError(e);
      return null;
    }
  }, []);

  const refreshCategories = useCallback(async () => {
    try {
      const json = await forumApi.categories();
      setCategories(json.data || []);
    } catch {
      // Categories failing to load is non-fatal — the rest of the app still works.
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const json = await forumApi.notifications({ limit: 30 });
      const items = json.data || [];
      unreadNotificationIdsRef.current = new Set(
        items
          .filter((notification) => !notification.read)
          .map((notification) => String(notification._id))
      );
      setNotifications(items);
      setUnreadCount(json.unreadCount || 0);
    } catch {
      // Notifications failing to load is non-fatal.
    }
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([refreshUser(), refreshCategories(), refreshNotifications()]);
      setBootDone(true);
    })();
  }, [refreshUser, refreshCategories, refreshNotifications]);

  const applyNotificationRead = useCallback((notificationId) => {
    const id = String(notificationId);
    const wasUnread = unreadNotificationIdsRef.current.delete(id);
    setNotifications((current) =>
      current.map((notification) =>
        String(notification._id) === id
          ? { ...notification, read: true }
          : notification
      )
    );
    if (wasUnread) {
      setUnreadCount((current) => Math.max(0, current - 1));
    }
  }, []);

  // ---- Socket subscriptions ----
  useEffect(() => {
    if (!socket || !connected) return;

    const off1 = on('notification:new', (notif) => {
      const id = String(notif._id);
      if (!unreadNotificationIdsRef.current.has(id)) {
        unreadNotificationIdsRef.current.add(id);
        setUnreadCount((current) => current + 1);
      }
      setNotifications((current) => [
        notif,
        ...current.filter((notification) => String(notification._id) !== id)
      ].slice(0, 50));
    });

    const off2 = on('notification:read', ({ _id }) => {
      applyNotificationRead(_id);
    });

    const off3 = on('notification:read-all', () => {
      unreadNotificationIdsRef.current.clear();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    });

    return () => {
      off1 && off1();
      off2 && off2();
      off3 && off3();
    };
  }, [applyNotificationRead, socket, connected, on]);

  // ---- Action helpers ----
  const toggleReaction = useCallback(async ({ targetType, target, type }) => {
    const json = await forumApi.toggleReaction({ targetType, target, type });
    return json.data;
  }, []);

  // Subscribe to live reaction updates for a specific post or comment.
  // Returns an unsubscribe function.
  const subscribeReaction = useCallback(
    (targetType, target, callback) => {
      if (!socket) return () => {};
      const handler = (payload) => {
        if (
          payload.targetType === targetType &&
          String(payload.target) === String(target)
        ) {
          callback(payload);
        }
      };
      socket.on('reaction:update', handler);
      return () => {
        socket.off('reaction:update', handler);
      };
    },
    [socket]
  );

  const subscribeComment = useCallback(
    (postId, callbacks = {}) => {
      if (!socket) return () => {};
      const onNew = (c) => callbacks.onNew && callbacks.onNew(c);
      const onUpdate = (c) => callbacks.onUpdate && callbacks.onUpdate(c);
      const onDelete = (payload) => callbacks.onDelete && callbacks.onDelete(payload);

      socket.on('comment:new', onNew);
      socket.on('comment:update', onUpdate);
      socket.on('comment:delete', onDelete);
      socket.emit('join:post', postId);

      return () => {
        socket.off('comment:new', onNew);
        socket.off('comment:update', onUpdate);
        socket.off('comment:delete', onDelete);
        socket.emit('leave:post', postId);
      };
    },
    [socket]
  );

  const createPost = useCallback(async (payload) => {
    const json = await forumApi.createPost(payload);
    return json.data;
  }, []);

  const updatePost = useCallback(async (id, patch) => {
    const json = await forumApi.updatePost(id, patch);
    return json.data;
  }, []);

  const deletePost = useCallback(async (id) => {
    await forumApi.deletePost(id);
  }, []);

  const toggleBookmark = useCallback(async (id) => {
    const json = await forumApi.toggleBookmark(id);
    return json.data;
  }, []);

  const createComment = useCallback(async (postId, payload) => {
    const json = await forumApi.createComment(postId, payload);
    return json.data;
  }, []);

  const updateComment = useCallback(async (id, payload) => {
    const json = await forumApi.updateComment(id, payload);
    return json.data;
  }, []);

  const deleteComment = useCallback(async (id) => {
    await forumApi.deleteComment(id);
  }, []);

  const markNotificationRead = useCallback(async (id) => {
    try {
      const response = await forumApi.markNotificationRead(id);
      if (response.data?.changed) applyNotificationRead(id);
    } catch {
      // Best-effort — we still mark the notification read locally even if the API call fails.
    }
  }, [applyNotificationRead]);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await forumApi.markAllNotificationsRead();
      unreadNotificationIdsRef.current.clear();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Best-effort — local optimistic state is the source of truth on failure.
    }
  }, []);

  const follow = useCallback(async (id) => {
    const json = await forumApi.follow(id);
    return json.data;
  }, []);

  const unfollow = useCallback(async (id) => {
    const json = await forumApi.unfollow(id);
    return json.data;
  }, []);

  const value = useMemo(
    () => ({
      // state
      user,
      categories,
      notifications,
      unreadCount,
      socketConnected: connected,
      bootDone,
      bootError,

      // refreshers
      refreshUser,
      refreshNotifications,

      // posts / comments / reactions
      createPost,
      updatePost,
      deletePost,
      toggleBookmark,
      createComment,
      updateComment,
      deleteComment,
      toggleReaction,
      subscribeReaction,
      subscribeComment,

      // notifications
      markNotificationRead,
      markAllNotificationsRead,

      // follow
      follow,
      unfollow
    }),
    [
      user,
      categories,
      notifications,
      unreadCount,
      connected,
      bootDone,
      bootError,
      refreshUser,
      refreshNotifications,
      createPost,
      updatePost,
      deletePost,
      toggleBookmark,
      createComment,
      updateComment,
      deleteComment,
      toggleReaction,
      subscribeReaction,
      subscribeComment,
      markNotificationRead,
      markAllNotificationsRead,
      follow,
      unfollow
    ]
  );

  return <ForumContext.Provider value={value}>{children}</ForumContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useForum() {
  const ctx = use(ForumContext);
  if (!ctx) throw new Error('useForum must be used inside <ForumProvider>');
  return ctx;
}
