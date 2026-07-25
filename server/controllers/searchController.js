const Post = require('../models/Post');
const User = require('../models/User');

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
  async categories(_req, res, next) {
    try {
      const counts = await Post.aggregate([
        { $match: { isHidden: false } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]);
      const map = new Map(counts.map((c) => [c._id, c.count]));
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

  /**
   * GET /api/search?q=&type=post|user|category|all
   */
  async search(req, res, next) {
    try {
      const q = String(req.query.q || '').trim().slice(0, 80);
      const type = String(req.query.type || 'all');
      if (!['all', 'post', 'posts', 'user', 'users', 'category', 'categories'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Invalid search type.' });
      }
      if (!q) return res.json({ success: true, data: { posts: [], users: [], categories: [] } });

      const result = { posts: [], users: [], categories: [] };
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

      const usersPromise = type === 'all' || type === 'user' || type === 'users'
        ? User.find({
          $or: [
            { name: new RegExp(`^${escaped}`, 'i') },
            { username: new RegExp(`^${escaped.toLowerCase()}`) }
          ],
          isBanned: { $ne: true }
        })
          .select('name username avatar role collegeName universityName reputation forumRole')
          .limit(20)
          .lean()
        : Promise.resolve([]);

      [result.posts, result.users] = await Promise.all([postsPromise, usersPromise]);

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
