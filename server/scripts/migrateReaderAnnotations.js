require('dotenv').config();
const mongoose = require('mongoose');
const Annotation = require('../models/Annotation');
const Highlight = require('../models/Highlight');

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(uri, { autoIndex: false });

  // Existing strokes predate stable client IDs. A deterministic value keeps
  // them erasable and makes the new per-user unique index safe to create.
  const backfill = await Annotation.updateMany(
    { $or: [{ clientId: { $exists: false } }, { clientId: null }, { clientId: '' }] },
    [{ $set: { clientId: { $concat: ['legacy:', { $toString: '$_id' }] } } }]
  );

  const indexes = await Annotation.collection.indexes();
  const obsolete = indexes.find((index) => index.name === 'userId_1_chapterId_1_pageNumber_1');
  if (obsolete) await Annotation.collection.dropIndex(obsolete.name);

  await Promise.all([Annotation.createIndexes(), Highlight.createIndexes()]);
  console.log(`Reader annotation migration complete. Backfilled ${backfill.modifiedCount || 0} strokes.`);
}

migrate()
  .catch((error) => {
    console.error('Reader annotation migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
