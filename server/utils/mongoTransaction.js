/**
 * Thin wrapper around Mongoose sessions for running multi-document transactions.
 *
 * Every call to `withMongoTransaction` opens a session, executes the callback
 * inside a transaction, and guarantees cleanup in the `finally` block.  The
 * transaction options are tuned for read-your-own-writes consistency and
 * durability across a replica set.
 */

const mongoose = require('mongoose');

/**
 * Options applied to every transaction.
 *
 * - readPreference: 'primary'          – Reads go to the primary so the
 *                                        transaction always sees its own writes.
 * - readConcern: { level: 'snapshot' }  – Provides snapshot isolation; the
 *                                        transaction sees a consistent point-
 *                                        in-time view of the data.
 * - writeConcern: { w: 'majority' }     – Writes are acknowledged only after
 *                                        being replicated to a majority of nodes,
 *                                        ensuring durability if a failover occurs.
 */
const TRANSACTION_OPTIONS = {
  readPreference: 'primary',
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' }
};

/**
 * Execute `work` inside a MongoDB transaction.
 *
 * The callback receives the active Mongoose session, which should be passed to
 * any Model query that participates in the transaction (e.g.
 * `Model.findById(...).session(session)`).
 *
 * The session is always closed, even if the callback throws.
 */
async function withMongoTransaction(work) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await work(session);
    }, TRANSACTION_OPTIONS);
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { withMongoTransaction, TRANSACTION_OPTIONS };
