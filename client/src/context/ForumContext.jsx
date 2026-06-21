import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import forumApi from '../services/forumApi';
import useSocket from '../hooks/useSocket';

/**
 * ForumContext
 * ----------------------------------------------------------------------------
 * Central store for the entire Community feature.
 * Mirrors the ergonomics of an RTK Query slice:
 *   - posts[], notifications[], unreadCount, user, categories
 *   - refreshFeed(), refreshNotifications()
 *   - toggleReaction({ targetType, target, type })
 *   - addComment({ postId, ... }), updateComment, deleteComment
 *   - createPost(payload), updatePost, deletePost
 *   - markNotificationRead(id), markAllNotificationsRead()
 *   - follow(id), unfollow(id)
 * Socket.IO events keep the state fresh across tabs in real time.
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
  const handlersRef = useRef({});

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
    } catch (e) {
      // non-fatal
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const json = await forumApi.notifications({ limit: 30 });
      setNotifications(json.data || []);
      setUnreadCount(json.unreadCount || 0);
    } catch (e) {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([refreshUser(), refreshCategories(), refreshNotifications()]);
      setBootDone(true);
    })();
  }, [refreshUser, refreshCategories, refreshNotifications]);

  // ---- Socket subscriptions ----
  useEffect(() => {
    if (!socket || !connected) return;

    const off1 = on('notification:new', (notif) => {
      setNotifications((prev) => [notif, ...prev].slice(0, 50));
      setUnreadCount((c) => c + 1);
    });

    const off2 = on('notification:read', ({ _id }) => {
      setNotifications((prev) => prev.map((n) => (n._id === _id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    });

    const off3 = on('notification:read-all', () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    });

    return () => {
      off1 && off1();
      off2 && off2();
      off3 && off3();
    };
  }, [socket, connected, on]);

  // ---- Action helpers ----
  const toggleReaction = useCallback(async ({ targetType, target, type }) => {
    try {
      const json = await forumApi.toggleReaction({ targetType, target, type });
      // Notify any listeners that have registered a per-target handler
      const key = `${targetType}:${target}`;
      const h = handlersRef.current[`reaction:${key}`];
      if (h) h(json.data);
      return json.data;
    } catch (e) {
      throw e;
    }
  }, []);

  /**
   * Subscribe to live reaction updates for a specific post or comment.
   * Returns an unsubscribe function.
   */
  const subscribeReaction = useCallback(
    (targetType, target, callback) => {
      if (!socket) return () => {};
      const key = `reaction:${targetType}:${target}`;
      const handler = (payload) => {
        if (
          payload.targetType === targetType &&
          String(payload.target) === String(target)
        ) {
          callback(payload);
        }
      };
      socket.on('reaction:update', handler);
      handlersRef.current[key] = handler;
      return () => {
        socket.off('reaction:update', handler);
        delete handlersRef.current[key];
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
      await forumApi.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      // best-effort
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await forumApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      // best-effort
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

export function useForum() {
  const ctx = useContext(ForumContext);
  if (!ctx) throw new Error('useForum must be used inside <ForumProvider>');
  return ctx;
}