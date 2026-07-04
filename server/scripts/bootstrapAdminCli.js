const path = require('node:path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const connectDB = require('../config/db');
const bootstrapAdmin = require('./bootstrapAdmin');

async function main() {
  await connectDB();

  if (mongoose.connection.readyState !== 1) {
    console.error('Could not connect to MongoDB. Admin bootstrap aborted.');
    process.exitCode = 1;
    return;
  }

  await bootstrapAdmin();
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error('Admin bootstrap CLI failed:', err.message);
  process.exitCode = 1;
});
