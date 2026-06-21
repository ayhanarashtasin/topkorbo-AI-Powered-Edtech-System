/**
 * On server startup, promote any user whose email appears in ADMIN_EMAILS
 * to forumRole: 'admin'. Idempotent and safe to run repeatedly.
 */
const User = require('../models/User');

async function bootstrapAdmin() {
  const raw = process.env.ADMIN_EMAILS || '';
  const emails = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!emails.length) return;
  try {
    const result = await User.updateMany(
      { email: { $in: emails } },
      { $set: { forumRole: 'admin' } }
    );
    if (result.modifiedCount) {
      console.log(`  Promoted ${result.modifiedCount} admin user(s) from ADMIN_EMAILS.`);
    }
  } catch (e) {
    console.warn('Admin bootstrap failed:', e.message);
  }
}

module.exports = bootstrapAdmin;