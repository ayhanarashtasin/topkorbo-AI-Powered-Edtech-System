const mongoose = require('mongoose');
const IeltsWritingSet = require('../models/IeltsWritingSet');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const result = await IeltsWritingSet.updateMany(
    { approvalStatus: 'pending' },
    { approvalStatus: 'approved' }
  );
  console.log('Updated writing sets:', JSON.stringify(result));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
