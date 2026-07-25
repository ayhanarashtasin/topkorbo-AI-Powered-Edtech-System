const mongoose = require('mongoose');

/**
 * Connect to MongoDB.
 *
 * Notes
 * -----
 * - We use a 5s `serverSelectionTimeoutMS` so that, on startup, an
 *   unreachable cluster (e.g. Atlas IP blocked, or DNS blackhole) fails
 *   fast instead of hanging the process and then buffering every query
 *   for the default 10s.
 * - On failure we keep the previous behaviour of NOT exiting the process:
 *   the landing page and health check should still work. But we expose
 *   `mongoose.connection.readyState` so middleware can 503 cleanly.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/topkorbo';

  if (mongoose.connection.listenerCount('error') === 0) {
    mongoose.connection.on('error', (error) => {
      console.error(` Mongoose Connection Error: ${error.message}`);
    });
    mongoose.connection.on('disconnected', () => {
      console.warn(' MongoDB disconnected. Will auto-reconnect on next query.');
    });
    mongoose.connection.on('reconnected', () => {
      console.log(' MongoDB reconnected');
    });
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE) || 10,
      minPoolSize: process.env.VERCEL ? 0 : 2,
      heartbeatFrequencyMS: 10000
    });
    console.log('MongoDB Atlas Connected');
  } catch (error) {
    console.error(`MongoDB Error: ${error.message}`);
    console.error(`   URI: ${redactUri(uri)}`);
    // Don't exit — allow server to run without DB for landing page
    console.log('Server running without database connection');
  }
};

/** Strip the password out of a Mongo URI for safe logging. */
function redactUri(uri) {
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/, '$1***$3');
}

/** True only when the connection is fully established (readyState === 1). */
function isDbReady() {
  return mongoose.connection.readyState === 1;
}

module.exports = connectDB;
module.exports.isDbReady = isDbReady;
