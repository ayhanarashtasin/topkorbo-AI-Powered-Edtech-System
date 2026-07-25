const path = require('node:path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Reaction = require('../models/Reaction');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const Report = require('../models/Report');
const User = require('../models/User');
const { scoreExpression } = require('../services/forumScoreService');

async function deduplicateReactions() {
  const duplicates = await Reaction.aggregate([
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $group: {
        _id: {
          targetType: '$targetType',
          target: '$target',
          user: '$user'
        },
        keep: { $first: '$_id' },
        duplicates: { $push: '$_id' },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]);

  for (const group of duplicates) {
    await Reaction.deleteMany({
      _id: { $in: group.duplicates.filter((id) => String(id) !== String(group.keep)) }
    });
  }
  return duplicates.length;
}

async function rebuildReactionCounts() {
  await Promise.all([
    Post.updateMany({}, { $set: { reactionsCount: { like: 0, love: 0 } } }),
    Comment.updateMany({}, { $set: { reactionsCount: { like: 0, love: 0 } } })
  ]);

  const counts = await Reaction.aggregate([
    {
      $group: {
        _id: { targetType: '$targetType', target: '$target', type: '$type' },
        count: { $sum: 1 }
      }
    }
  ]);

  const operations = { post: [], comment: [] };
  for (const entry of counts) {
    const targetType = entry._id.targetType;
    if (!operations[targetType]) continue;
    operations[targetType].push({
      updateOne: {
        filter: { _id: entry._id.target },
        update: { $set: { [`reactionsCount.${entry._id.type}`]: entry.count } }
      }
    });
  }

  await Promise.all([
    operations.post.length ? Post.bulkWrite(operations.post) : Promise.resolve(),
    operations.comment.length ? Comment.bulkWrite(operations.comment) : Promise.resolve()
  ]);
}

async function rebuildCommentCounts() {
  await Promise.all([
    Post.updateMany({}, { $set: { commentsCount: 0 } }),
    Comment.updateMany({}, { $set: { repliesCount: 0 } })
  ]);

  const [postCounts, replyCounts] = await Promise.all([
    Comment.aggregate([
      { $match: { isHidden: false } },
      { $group: { _id: '$post', count: { $sum: 1 } } }
    ]),
    Comment.aggregate([
      { $match: { isHidden: false, parent: { $ne: null } } },
      { $group: { _id: '$parent', count: { $sum: 1 } } }
    ])
  ]);

  await Promise.all([
    postCounts.length
      ? Post.bulkWrite(postCounts.map((entry) => ({
        updateOne: {
          filter: { _id: entry._id },
          update: { $set: { commentsCount: entry.count } }
        }
      })))
      : Promise.resolve(),
    replyCounts.length
      ? Comment.bulkWrite(replyCounts.map((entry) => ({
        updateOne: {
          filter: { _id: entry._id },
          update: { $set: { repliesCount: entry.count } }
        }
      })))
      : Promise.resolve()
  ]);
}

async function rebuildBookmarkCounts() {
  await Post.updateMany({}, { $set: { bookmarksCount: 0 } });
  const counts = await User.aggregate([
    { $unwind: '$bookmarks' },
    { $group: { _id: '$bookmarks', count: { $sum: 1 } } }
  ]);
  if (!counts.length) return;

  await Post.bulkWrite(counts.map((entry) => ({
    updateOne: {
      filter: { _id: entry._id },
      update: { $set: { bookmarksCount: entry.count } }
    }
  })));
}

async function deduplicateActiveReports() {
  const duplicateGroups = await Report.aggregate([
    { $match: { status: { $in: ['open', 'under_review'] } } },
    { $sort: { createdAt: 1, _id: 1 } },
    {
      $group: {
        _id: {
          reporter: '$reporter',
          targetType: '$targetType',
          target: '$target'
        },
        keep: { $first: '$_id' },
        ids: { $push: '$_id' },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]);

  for (const group of duplicateGroups) {
    await Report.updateMany(
      {
        _id: {
          $in: group.ids.filter((id) => String(id) !== String(group.keep))
        }
      },
      {
        $set: {
          status: 'dismissed',
          actionTaken: 'deduplicated_by_migration',
          reviewedAt: new Date()
        }
      }
    );
  }
  return duplicateGroups.length;
}

async function rebuildIndexes() {
  const indexes = await Reaction.collection.indexes();
  const legacy = indexes.find(
    (index) => index.name === 'targetType_1_target_1_user_1_type_1'
  );
  if (legacy) await Reaction.collection.dropIndex(legacy.name);

  await Reaction.collection.createIndex(
    { targetType: 1, target: 1, user: 1 },
    { unique: true, name: 'targetType_1_target_1_user_1' }
  );

  await Promise.all([
    Post.createIndexes(),
    Comment.createIndexes(),
    Notification.createIndexes(),
    Report.createIndexes()
  ]);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri, { autoIndex: false });
  const duplicateGroups = await deduplicateReactions();
  const duplicateReportGroups = await deduplicateActiveReports();
  await rebuildReactionCounts();
  await rebuildCommentCounts();
  await rebuildBookmarkCounts();
  await Post.updateMany({}, [{ $set: { score: scoreExpression } }]);
  await rebuildIndexes();
  console.log(
    `Forum migration complete. Deduplicated ${duplicateGroups} reaction groups and ` +
      `${duplicateReportGroups} active-report groups; rebuilt derived counters and indexes.`
  );
}

main()
  .catch((error) => {
    console.error('Forum migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
