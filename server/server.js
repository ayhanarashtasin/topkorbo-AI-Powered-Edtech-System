const { execSync } = require('child_process');
const dns = require('node:dns');
const path = require('node:path');
const fs = require('node:fs');

try {
  if (process.platform === 'win32') {
    const output = execSync('powershell -Command "(Get-DnsClientServerAddress -AddressFamily IPv4).ServerAddresses"', { encoding: 'utf8' });
    const dnsServers = output
      .split(/[\r\n]+/)
      .map(s => s.trim())
      .filter(s => s && s !== '127.0.0.1' && s !== '::1');

    if (dnsServers.length > 0) {
      // Prepend public DNS servers to resolve MongoDB Atlas SRV records successfully
      const serversToSet = ['8.8.8.8', '1.1.1.1', ...dnsServers];
      dns.setServers(serversToSet);
      console.log('🔄 Set Node.js DNS Servers dynamically:', serversToSet);
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
const contestRoutes = require('./routes/contestRoutes');
const bookRoutes = require('./routes/bookRoutes');
const highlightRoutes = require('./routes/highlightRoutes');

// Load Passport Configuration
require('./config/passport');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  exposedHeaders: ['Accept-Ranges', 'Content-Encoding', 'Content-Length', 'Content-Range']
}));
app.use(express.json({ limit: '16mb' }));
app.use(express.urlencoded({ limit: '16mb', extended: true }));
app.use(passport.initialize());

// Serve uploaded book PDFs
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '7d',
  etag: true,
  lastModified: true
}));

// Routes
app.use('/api/landing', landingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/contests', contestRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/highlights', highlightRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'TopKorbo API is running 🚀' });
});

// Global error handler
app.use(errorHandler);

// Prevent crashes from unhandled errors
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
});

const server = app.listen(PORT, () => {
  console.log(`🚀 TopKorbo Server running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use.`);
    console.error(`💡 To fix this manually, you can run:`);
    console.error(`   Windows (PowerShell): Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force`);
    console.error(`   Linux/macOS: kill -9 $(lsof -t -i:${PORT})`);
    console.error(`\nAttempting to automatically free port ${PORT}...`);

    try {
      const { execSync } = require('child_process');
      if (process.platform === 'win32') {
        const output = execSync('netstat -ano', { encoding: 'utf8' });
        const lines = output.split('\n');
        let killed = false;
        for (const line of lines) {
          if (line.includes(`:${PORT}`) && line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(pid) && pid !== '0') {
              console.log(`Killing process with PID ${pid} occupying port ${PORT}...`);
              execSync(`taskkill /F /PID ${pid}`);
              killed = true;
            }
          }
        }
        if (killed) {
          console.log(`✅ Port ${PORT} freed! Please restart the server.`);
        } else {
          console.log(`Could not identify the listening process on port ${PORT}.`);
        }
      } else {
        execSync(`kill -9 $(lsof -t -i:${PORT})`);
        console.log(`✅ Port ${PORT} freed! Please restart the server.`);
      }
    } catch (killError) {
      console.error(`⚠️ Could not automatically free port ${PORT}:`, killError.message);
    }
    process.exit(1);
  } else {
    throw err;
  }
});

