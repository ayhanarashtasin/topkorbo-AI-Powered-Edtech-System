const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const Reaction = require('../models/Reaction');
const Bookmark = require('../models/Bookmark');
const Follow = require('../models/Follow');
const { uploadImage, deleteImage } = require('../services/uploadService');
const { sanitize, htmlToText } = require('../services/sanitizeService');
const { ensureUsername, resolveMentions } = require('../services/mentionService');
const { notify } = require('../services/notificationService');
const {
  recomputePostScore,
  refreshTrendingScores
} = require('../services/forumScoreService');
const { getIO } = require('../socket');
const { withMongoTransaction } = require('../utils/mongoTransaction');
const {
  clampLimit,
  descendingCursorFilter,
  finalizePage
} = require('../utils/forumPagination');
const {
  POST_HTML_MAX,
  validateHtmlLength,
  normalizeTags,
  normalizeCategory
} = require('../utils/forumValidation');

const PAGE_SIZE = 20;

const POPULATE_AUTHOR = 'name username avatar role collegeName universityName department hscBatch stream forumRole reputation';

async function attachUserPostState(docs, userId, options = {}) {
  if (!docs || docs.length === 0) return docs;
  if (!userId) {
    for (const d of docs) {
      d.userReaction = null;
      d.bookmarked = false;
    }
    return docs;
  }

  const ids = docs.map((d) => d._id);
  const [myReactions, myBookmarks] = await Promise.all([
    Reaction.find({
      targetType: 'post',
      target: { $in: ids },
      user: userId
    }).lean(),
    options.allBookmarked
      ? []
      : Bookmark.find({ user: userId, post: { $in: ids } }).select('post').lean()
  ]);

  const reactionMap = {};
  for (const r of myReactions) reactionMap[String(r.target)] = r.type;
  const bookmarkedIds = new Set(myBookmarks.map((bookmark) => String(bookmark.post)));
  for (const d of docs) {
    d.userReaction = reactionMap[String(d._id)] || null;
    d.bookmarked = options.allBookmarked || bookmarkedIds.has(String(d._id));
  }
  return docs;
}

async function uploadPostImages(req) {
  const files = (req.files || []).slice(0, 8);
  const out = [];
  try {
    for (const f of files) {
      // Keep per-request memory and outbound bandwidth bounded.
      // eslint-disable-next-line no-await-in-loop
      const uploaded = await uploadImage(f, req.user.id, 'topkorbo/forum/posts');
      out.push(uploaded);
    }
    return out;
  } catch (error) {
    await Promise.allSettled(
      out.map((image) => deleteImage(image.publicId, image.url))
    );
    throw error;
  }
}

function imageKey(image) {
  return image.publicId || image.url;
}

const postController = {
  /**
   * POST /api/posts
   * multipart/form-data with fields:
   *   - contentHtml (required)
   *   - title (optional)
   *   - category (optional, default "General")
   *   - type ("text" | "question", default "text")
   *   - tags (comma-separated)
   *   - images (up to 8 files)
   */
  async create(req, res, next) {
    try {
      const author = await User.findById(req.user.id);
      if (!author) return res.status(404).json({ success: false, message: 'User not found' });
      if (author.isBanned) {
        return res.status(403).json({ success: false, message: 'Account is suspended.' });
      }
      await ensureUsername(author);

      const { contentHtml: rawHtml, title, category, type, tags } = req.body;
      const htmlError = validateHtmlLength(rawHtml, POST_HTML_MAX, 'Post body');
      if (htmlError) {
        return res.status(400).json({ success: false, message: htmlError });
      }
      const safeHtml = sanitize(rawHtml);
      if (!safeHtml || !htmlToText(safeHtml)) {
        return res.status(400).json({ success: false, message: 'Post body cannot be empty.' });
      }

      const normalizedCategory = normalizeCategory(category);
      if (!normalizedCategory) {
        return res.status(400).json({ success: false, message: 'Invalid category.' });
      }

      const { ids: mentionIds } = await resolveMentions(safeHtml);
      const tagList = normalizeTags(tags);
      const images = await uploadPostImages(req);
      let post;
      try {
        post = await Post.create({
          author: author._id,
          type: type === 'question' ? 'question' : 'text',
          category: normalizedCategory,
          title: title ? String(title).trim().slice(0, 200) : undefined,
          contentHtml: safeHtml,
          contentText: htmlToText(safeHtml, 5000),
          images,
          mentions: mentionIds,
          tags: tagList,
          score: 0,
          groupVisibility: author.stream ? [author.stream] : []
        });
      } catch (error) {
        await Promise.allSettled(
          images.map((image) => deleteImage(image.publicId, image.url))
        );
        throw error;
      }

      const populated = await Post.findById(post._id).populate('author', POPULATE_AUTHOR);

      // Broadcast + mention notifications
      const io = getIO();
      io.to('forum').emit('post:new', populated);
      await Promise.allSettled(
        mentionIds.map((uid) => notify(io, {
          recipient: uid,
          actor: author._id,
          type: 'mention',
          post: post._id,
          message: `${author.name} mentioned you in a post.`,
          preview: post.contentText.slice(0, 120)
        }))
      );

      return res.status(201).json({ success: true, data: populated });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/posts?feed=latest|trending|following|discussed&category=&cursor=
   */
  async feed(req, res, next) {
    try {
      const requestedFeed = String(req.query.feed || 'latest');
      const feed = ['latest', 'trending', 'following', 'discussed'].includes(requestedFeed)
        ? requestedFeed
        : 'latest';
      const category = req.query.category ? String(req.query.category) : null;
      const cursor = req.query.cursor;
      const limit = clampLimit(req.query.limit, PAGE_SIZE, 50);

      const baseFilter = { isHidden: false };
      if (category && category !== 'All') {
        const normalizedCategory = normalizeCategory(category);
        if (!normalizedCategory) {
          return res.status(400).json({ success: false, message: 'Invalid category.' });
        }
        baseFilter.category = normalizedCategory;
      }

      if (feed === 'following' && req.user) {
        const ids = await Follow.find({ follower: req.user.id }).distinct('following');
        if (!ids.length) {
          return res.json({ success: true, data: [], nextCursor: null });
        }
        baseFilter.author = { $in: ids };
      }

      let sort = { createdAt: -1, _id: -1 };
      let cursorFields = ['createdAt'];
      if (feed === 'trending') {
        await refreshTrendingScores();
        sort = { score: -1, createdAt: -1, _id: -1 };
        cursorFields = ['score', 'createdAt'];
      } else if (feed === 'discussed') {
        sort = { commentsCount: -1, createdAt: -1, _id: -1 };
        cursorFields = ['commentsCount', 'createdAt'];
      }

      const cursorFilter = descendingCursorFilter(cursor, cursorFields);
      if (cursorFilter) Object.assign(baseFilter, cursorFilter);

      const posts = await Post.find(baseFilter)
        .sort(sort)
        .limit(limit + 1)
        .populate('author', POPULATE_AUTHOR)
        .lean({ virtuals: true });

      const page = finalizePage(posts, limit, cursorFields);
      await attachUserPostState(page.items, req.user?.id);

      return res.json({
        success: true,
        data: page.items,
        nextCursor: page.nextCursor
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/posts/:id
   */
  async getOne(req, res, next) {
    try {
      const post = await Post.findById(req.params.id)
        .populate('author', POPULATE_AUTHOR)
        .lean({ virtuals: true });
        
      if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
      if (post.isHidden) {
        const isOwner = req.user && String(req.user.id) === String(post.author._id);
        const isAdmin = req.user && (req.user.forumRole === 'admin' || req.user.forumRole === 'moderator');
        if (!isOwner && !isAdmin) {
          return res.status(404).json({ success: false, message: 'Post not found' });
        }
      }
      
      await attachUserPostState([post], req.user?.id);
      
      return res.json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/posts/:id  (author only)
   */
  async update(req, res, next) {
    try {
      const post = await Post.findById(req.params.id);
      if (!post || post.isHidden) {
        return res.status(404).json({ success: false, message: 'Post not found' });
      }
      if (String(post.author) !== String(req.user.id)) {
        return res.status(403).json({ success: false, message: 'Not your post' });
      }
      const { contentHtml, title, category, tags, type } = req.body;
      let removedImages = [];
      let uploadedImages = [];
      if (contentHtml !== undefined) {
        const htmlError = validateHtmlLength(contentHtml, POST_HTML_MAX, 'Post body');
        if (htmlError) {
          return res.status(400).json({ success: false, message: htmlError });
        }
        const safe = sanitize(contentHtml);
        if (!safe || !htmlToText(safe)) {
          return res.status(400).json({ success: false, message: 'Post body cannot be empty.' });
        }
        post.contentHtml = safe;
        post.contentText = htmlToText(safe, 5000);
        const { ids: mentionIds } = await resolveMentions(safe);
        post.mentions = mentionIds;
      }
      if (title !== undefined) post.title = String(title).trim().slice(0, 200);
      if (category !== undefined) {
        const normalizedCategory = normalizeCategory(category);
        if (!normalizedCategory) {
          return res.status(400).json({ success: false, message: 'Invalid category.' });
        }
        post.category = normalizedCategory;
      }
      if (type === 'text' || type === 'question') post.type = type;
      if (tags !== undefined) post.tags = normalizeTags(tags);

      if (req.body.keepImages !== undefined || (req.files || []).length > 0) {
        let keepKeys;
        try {
          const parsed = req.body.keepImages === undefined
            ? (post.images || []).map(imageKey)
            : JSON.parse(req.body.keepImages || '[]');
          keepKeys = new Set(Array.isArray(parsed) ? parsed.map(String) : []);
        } catch {
          return res.status(400).json({ success: false, message: 'Invalid image selection.' });
        }

        const keptImages = (post.images || []).filter((image) =>
          keepKeys.has(String(imageKey(image)))
        );
        removedImages = (post.images || []).filter((image) =>
          !keepKeys.has(String(imageKey(image)))
        );
        if (keptImages.length + (req.files || []).length > 8) {
          return res.status(400).json({
            success: false,
            message: 'A post can contain at most 8 images.'
          });
        }

        uploadedImages = await uploadPostImages(req);
        post.images = [...keptImages, ...uploadedImages];
      }

      post.isEdited = true;
      post.editedAt = new Date();
      try {
        await post.save();
      } catch (error) {
        await Promise.allSettled(
          uploadedImages.map((image) => deleteImage(image.publicId, image.url))
        );
        throw error;
      }

      await Promise.allSettled(
        removedImages.map((image) => deleteImage(image.publicId, image.url))
      );

      const populated = await Post.findById(post._id).populate('author', POPULATE_AUTHOR);
      const io = getIO();
      io.to(['forum', `post:${String(post._id)}`]).emit('post:update', populated);

      return res.json({ success: true, data: populated });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/posts/:id  (owner or admin)
   */
  async remove(req, res, next) {
    try {
      const post = await Post.findById(req.params.id);
      if (!post || post.isHidden) {
        return res.status(404).json({ success: false, message: 'Post not found' });
      }
      const isOwner = String(post.author) === String(req.user.id);
      const isAdmin = req.user.forumRole === 'admin' || req.user.forumRole === 'moderator';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      post.isHidden = true;
      post.hiddenReason = isAdmin && !isOwner ? 'Removed by moderator' : 'Deleted by author';
      await post.save();
      await Promise.allSettled(
        post.images.map((image) => deleteImage(image.publicId, image.url))
      );
      const io = getIO();
      io.to(['forum', `post:${String(post._id)}`]).emit('post:delete', { postId: post._id });
      return res.json({ success: true, data: { _id: post._id } });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/posts/:id/bookmark  (toggle)
   */
  async toggleBookmark(req, res, next) {
    try {
      const result = await withMongoTransaction(async (session) => {
        const post = await Post.findOne({ _id: req.params.id, isHidden: false })
          .select('_id')
          .session(session);
        if (!post) return null;

        const existing = await Bookmark.findOne({
          user: req.user.id,
          post: post._id
        }).session(session);
        const bookmarked = !existing;

        if (existing) {
          await Bookmark.deleteOne({ _id: existing._id }).session(session);
        } else {
          await Bookmark.create([{
            user: req.user.id,
            post: post._id
          }], { session });
        }

        const updated = await Post.findOneAndUpdate(
          { _id: post._id, isHidden: false },
          [{
            $set: {
              bookmarksCount: {
                $max: [
                  0,
                  {
                    $add: [
                      { $ifNull: ['$bookmarksCount', 0] },
                      bookmarked ? 1 : -1
                    ]
                  }
                ]
              }
            }
          }],
          { new: true, session, timestamps: false }
        ).select('bookmarksCount').lean();

        if (!updated) {
          const error = new Error('Post not found');
          error.statusCode = 404;
          throw error;
        }
        return { bookmarked, bookmarksCount: updated.bookmarksCount || 0 };
      });

      if (!result) {
        return res.status(404).json({ success: false, message: 'Post not found' });
      }
      return res.json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/users/:id/posts — posts by a user
   */
  async byUser(req, res, next) {
    try {
      const limit = clampLimit(req.query.limit, PAGE_SIZE, 50);
      const cursor = req.query.cursor;
      const filter = { author: req.params.id, isHidden: false };
      const cursorFields = ['createdAt'];
      const cursorFilter = descendingCursorFilter(cursor, cursorFields);
      if (cursorFilter) Object.assign(filter, cursorFilter);
      const posts = await Post.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .populate('author', POPULATE_AUTHOR)
        .lean({ virtuals: true });
        
      const page = finalizePage(posts, limit, cursorFields);
      await attachUserPostState(page.items, req.user?.id);
      return res.json({
        success: true,
        data: page.items,
        nextCursor: page.nextCursor
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/users/me/bookmarks
   */
  async myBookmarks(req, res, next) {
    try {
      const limit = clampLimit(req.query.limit, PAGE_SIZE, 50);
      const filter = { user: req.user.id };
      const cursorFields = ['createdAt'];
      const cursorFilter = descendingCursorFilter(req.query.cursor, cursorFields);
      if (cursorFilter) Object.assign(filter, cursorFilter);

      const bookmarks = await Bookmark.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .lean();
      const page = finalizePage(bookmarks, limit, cursorFields);
      if (!page.items.length) {
        return res.json({ success: true, data: [], nextCursor: null });
      }

      const ids = page.items.map((bookmark) => bookmark.post);
      const posts = await Post.find({ _id: { $in: ids }, isHidden: false })
        .populate('author', POPULATE_AUTHOR)
        .lean({ virtuals: true });

      const postMap = new Map(posts.map((post) => [String(post._id), post]));
      const orderedPosts = ids.map((id) => postMap.get(String(id))).filter(Boolean);
      await attachUserPostState(orderedPosts, req.user?.id, { allBookmarked: true });

      return res.json({
        success: true,
        data: orderedPosts,
        nextCursor: page.nextCursor
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Recompute score for one post (called after reaction/comment changes).
   */
  async recomputeScore(postId) {
    try {
      await recomputePostScore(postId);
    } catch (e) {
      // best-effort
    }
  }
};

module.exports = postController;
