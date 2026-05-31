const { execSync } = require('child_process');
const dns = require('node:dns');
const path = require('node:path');

try {
  if (process.platform === 'win32') {
    const output = execSync('powershell -Command "(Get-DnsClientServerAddress -AddressFamily IPv4).ServerAddresses"', { encoding: 'utf8' });
    const dnsServers = output
      .split(/[\r\n]+/)
      .map(s => s.trim())
      .filter(s => s && s !== '127.0.0.1' && s !== '::1');
    
    if (dnsServers.length > 0) {
      dns.setServers(dnsServers);
      console.log('🔄 Set Node.js DNS Servers dynamically:', dnsServers);
    }
  }
} catch (e) {
  console.log('⚠️ Failed to load system DNS servers, using default:', e.message);
}

require('dotenv').config({ path: path.resolve(__dirname, '.env'), override: true });
const express = require('express');
const cors = require('cors');
const passport = require('passport');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const landingRoutes = require('./routes/landingRoutes');
const authRoutes = require('./routes/authRoutes');
const questionRoutes = require('./routes/questionRoutes');

// Load Passport Configuration
require('./config/passport');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '16mb' }));
app.use(express.urlencoded({ limit: '16mb', extended: true }));
app.use(passport.initialize());

// Routes
app.use('/api/landing', landingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'TopKorbo API is running 🚀' });
});

// Global error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 TopKorbo Server running on port ${PORT}`);
});
