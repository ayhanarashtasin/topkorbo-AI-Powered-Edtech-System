const path = require('node:path');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const connectDB = require('../config/db');
const User = require('../models/User');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed:admin is disabled in production.');
  }

  const email = String(process.env.ADMIN_SEED_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_SEED_PASSWORD || '');
  const name = String(process.env.ADMIN_SEED_NAME || '').trim();

  if (!email || !password || !name) {
    throw new Error(
      'Missing admin seed env values. Set ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD, and ADMIN_SEED_NAME in server/.env.'
    );
  }

  await connectDB();

  if (mongoose.connection.readyState !== 1) {
    throw new Error('Could not connect to MongoDB. Admin seed aborted.');
  }

  const passwordHash = hashPassword(password);
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    existingUser.name = name || existingUser.name;
    existingUser.forumRole = 'admin';
    existingUser.accountStatus = 'active';
    existingUser.statusReason = '';
    existingUser.isBanned = false;
    existingUser.banReason = '';
    existingUser.banExpiresAt = null;
    existingUser.suspendedAt = null;
    existingUser.statusChangedAt = new Date();
    existingUser.passwordHash = passwordHash;
    if (!existingUser.role) {
      existingUser.role = 'student';
    }
    if (existingUser.role === 'student' && !existingUser.collegeName) {
      existingUser.collegeName = 'Local Admin Test Account';
    }
    if (!existingUser.googleId) {
      existingUser.googleId = `seed-admin:${email}`;
    }
    await existingUser.save();
    console.log(`Admin seed updated existing user: ${email}`);
  } else {
    await User.create({
      googleId: `seed-admin:${email}`,
      name,
      email,
      passwordHash,
      role: 'student',
      collegeName: 'Local Admin Test Account',
      forumRole: 'admin',
      accountStatus: 'active',
      statusReason: '',
      isBanned: false
    });
    console.log(`Admin seed created new user: ${email}`);
  }

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('Admin seed failed:', err.message);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close().catch(() => {});
  }
  process.exitCode = 1;
});
