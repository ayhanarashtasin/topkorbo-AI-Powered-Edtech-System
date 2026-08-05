const Post = require('../models/Post');
const User = require('../models/User');
const {
  normalizeSearchText,
  escapeRegex
} = require('../utils/searchNormalization');

// Allowed post categories used for filtering search results
const CATEGORIES = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'General',
  'Exam',
  'Assignment',
  'Other'
];

const searchController = {
  // GET /api/search/categories
  // Returns post counts per category to populate the sidebar/filter UI
  async categories(_req, res, next) {
    try {
      // Aggregate non-hidden posts by category to get live counts
      const counts = await Post.aggregate([
        { $match: { isHidden: false } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]);

      // Convert aggregation result to a lookup map
      const map = new Map(counts.map((c) => [c._id, c.count]));

      // Merge counts with the fixed category list, defaulting to 0
      const data = CATEGORIES.map((name) => ({
        name,
        count: map.get(name) || 0
      }));

      const total = data.reduce((sum, c) => sum + c.count, 0);
      return res.json({ success: true, data: [{ name: 'All', count: total }, ...data] });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/search?q=&type=post|user|category|all
  // Unified search endpoint supporting posts, users, and categories
  async search(req, res, next) {
    try {
      // Sanitize and limit query length to prevent abuse
      const q = String(req.query.q || '').trim().slice(0, 80);
      const type = String(req.query.type || 'all');

      if (!['all', 'post', 'posts', 'user', 'users', 'category', 'categories'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Invalid search type.' });
      }

      // Return empty results immediately for blank queries
      if (!q) return res.json({ success: true, data: { posts: [], users: [], categories: [] } });

      const result = { posts: [], users: [], categories: [] };
      const escaped = escapeRegex(q);

      // Build post search promise using MongoDB text index for relevance-ranked results
      const postsPromise = type === 'all' || type === 'post' || type === 'posts'
        ? Post.find(
          { $text: { $search: q }, isHidden: false },
          { score: { $meta: 'textScore' } }
        )
          .sort({ score: { $meta: 'textScore' } })
          .limit(20)
          .populate('author', 'name username avatar role collegeName universityName reputation')
          .lean({ virtuals: true })
        : Promise.resolve([]);

      // Build user search promise using prefix-matching on normalized name and username
      // This provides autocomplete-style results without requiring a text index
      const usersPromise = type === 'all' || type === 'user' || type === 'users'
        ? User.find({
          $or: [
            { searchName: new RegExp(`^${escapeRegex(normalizeSearchText(q))}`) },
            { username: new RegExp(`^${escapeRegex(q.toLowerCase())}`) }
          ],
          isBanned: { $ne: true },
          accountStatus: { $in: [null, 'active'] }
        })
          .select('name username avatar role collegeName universityName reputation forumRole')
          .limit(20)
          .lean()
        : Promise.resolve([]);

      // Execute both searches in parallel for faster response
      [result.posts, result.users] = await Promise.all([postsPromise, usersPromise]);

      // Filter the fixed category list client-side using case-insensitive regex
      if (type === 'all' || type === 'category' || type === 'categories') {
        const regex = new RegExp(escaped, 'i');
        result.categories = CATEGORIES.filter((c) => regex.test(c)).map((name) => ({
          name,
          count: 0
        }));
      }

      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = searchController;
