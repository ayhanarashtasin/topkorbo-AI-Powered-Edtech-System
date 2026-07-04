const { execSync } = require("child_process");
const dns = require("node:dns");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

require("dotenv").config({ path: path.resolve(__dirname, ".env") });

try {
  const mongoUri = process.env.MONGODB_URI || "";
  const isAtlasSrvUri =
    process.platform === "win32" && mongoUri.startsWith("mongodb+srv://");

  if (isAtlasSrvUri) {
    // Atlas SRV lookups are flaky on some Windows/router DNS setups.
    // Using clean public resolvers avoids the mixed-resolver failures that
    // cause `Server selection timed out` during startup.
    const atlasDnsServers = ["8.8.8.8", "1.1.1.1"];
    dns.setServers(atlasDnsServers);

    if (typeof dns.setDefaultResultOrder === "function") {
      dns.setDefaultResultOrder("ipv4first");
    }
  }
} catch (e) {
  console.log("Failed to configure DNS for MongoDB Atlas:", e.message);
}
const express = require("express");
const cors = require("cors");
const passport = require("passport");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
const landingRoutes = require("./routes/landingRoutes");
const authRoutes = require("./routes/authRoutes");
const questionRoutes = require("./routes/questionRoutes");
const contestRoutes = require("./routes/contestRoutes");
const battleRoutes = require("./routes/battleRoutes");
const bookRoutes = require("./routes/bookRoutes");
const highlightRoutes = require("./routes/highlightRoutes");
const evaluationRoutes = require("./routes/evaluationRoutes");
const aiRoutes = require("./routes/aiRoutes");
const studyRoutineRoutes = require("./routes/studyRoutineRoutes");
const mentorRoutes = require("./routes/mentorRoutes");
const mockTestRoutes = require("./routes/mockTestRoutes");
const liveClassRoutes = require("./routes/liveClassRoutes");
const ieltsRoutes = require("./routes/ieltsRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/admin.routes");

// Community / Forum
const postRoutes = require("./routes/postRoutes");
const { postComments, router: commentRoutes } = require("./routes/commentRoutes");
const reactionRoutes = require("./routes/reactionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const searchRoutes = require("./routes/searchRoutes");
const moderationRoutes = require("./routes/moderationRoutes");
const userRoutes = require("./routes/userRoutes");
const practiceRoutes = require("./routes/practiceRoutes");
const { initSocket } = require("./socket");
const bootstrapAdmin = require("./scripts/bootstrapAdmin");

// Load Passport Configuration
require("./config/passport");

const app = express();
const PORT = process.env.PORT || 5000;

// Dynamic API responses must always include a body. Browser revalidation can
// otherwise turn JSON endpoints such as /api/auth/me into empty 304 responses,
// which breaks callers that immediately parse response.json() after refresh.
app.set("etag", false);

// Fail closed on missing or placeholder JWT secret. The auth middleware
// (middleware/auth.js) and the socket.io handshake (socket/index.js) both
// rely on JWT_SECRET for token verification. Silently falling back to a
// hard-coded placeholder would let anyone forge tokens and take over
// accounts — including mentor accounts that can mint LiveKit room tokens.
const PLACEHOLDER_JWT_SECRETS = new Set(['24241122', 'changeme', 'secret', '']);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || PLACEHOLDER_JWT_SECRETS.has(jwtSecret)) {
  console.error(
    '\nFATAL: JWT_SECRET is missing or set to a known placeholder.\n' +
      'Set JWT_SECRET in server/.env to a strong random value, e.g.:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64\'))"\n',
  );
  process.exit(1);
}

// Connect to MongoDB
connectDB();

// Middleware
app.use(
  cors({
    exposedHeaders: [
      "Accept-Ranges",
      "Content-Encoding",
      "Content-Length",
      "Content-Range",
    ],
  }),
);
// JSON body parser with a `verify` callback that stashes the raw bytes on
// req.rawBody before parsing. Routes that need HMAC verification over the
// exact wire bytes (e.g. LiveKit webhooks) read req.rawBody from here. This
// is the canonical Express pattern — body-parser only reads the stream
// once, and we get both the raw bytes AND the parsed object.
app.use(
  express.json({
    limit: "16mb",
    verify: (req, _res, buf) => {
      if (buf && buf.length > 0) {
        req.rawBody = buf.toString("utf8");
      }
    },
  }),
);
app.use(express.urlencoded({ limit: "16mb", extended: true }));
app.use(passport.initialize());

app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// Serve uploaded book PDFs
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use(
  "/uploads",
  express.static(uploadsDir, {
    maxAge: "7d",
    etag: true,
    lastModified: true,
  }),
);

// Routes
app.use("/api/landing", landingRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/contests", contestRoutes);
app.use("/api/battles", battleRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/highlights", highlightRoutes);
app.use("/api/evaluate", evaluationRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/study-routine", studyRoutineRoutes);
app.use("/api/mentor-connections", mentorRoutes);
app.use("/api/mock-tests", mockTestRoutes);
app.use("/api/live-class", liveClassRoutes);
app.use("/api/ielts", ieltsRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

// === Forum / Community routes ===
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/posts/:postId/comments", postComments);
app.use("/api/comments", commentRoutes);
app.use("/api/reactions", reactionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/search", searchRoutes);
app.use("/api", moderationRoutes);
app.use("/api/practice", practiceRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "TopKorbo API is running 🚀" });
});

// Serve the built React app when the backend hosts production assets. The
// catch-all keeps BrowserRouter routes refresh-safe, e.g. /student/find-mentor.
//
// Everything below is registered UNCONDITIONALLY and resolved per-request, so
// the order of `npm run build` vs. starting the server no longer matters. (The
// previous startup-time `fs.existsSync` guard meant that a server started
// before the client was built never registered these handlers, so every
// non-API URL 404'd on refresh — a blank white page.)
const clientDistDir = path.resolve(__dirname, "../client/dist");
const clientIndexPath = path.join(clientDistDir, "index.html");

// `express.static` no-ops per request when a file is missing, so it's safe to
// register even before the client is built — it just falls through.
app.use(express.static(clientDistDir));

app.get("*", (req, res, next) => {
  // Never swallow API / uploads routes with the SPA fallback.
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ success: false, message: "API route not found" });
  }
  if (req.path.startsWith("/uploads")) {
    return res.status(404).end();
  }
  // Serve the SPA shell if a build exists; otherwise fall through (e.g. in a
  // dev-only backend where the frontend is served by Vite on another port).
  if (fs.existsSync(clientIndexPath)) {
    return res.sendFile(clientIndexPath);
  }
  return next();
});

// Global error handler
app.use(errorHandler);

// Prevent crashes from unhandled errors
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err.message);
  console.error(err.stack);
});
process.on("unhandledRejection", (reason) => {
  console.error(" UNHANDLED REJECTION:", reason);
});

const httpServer = http.createServer(app);
initSocket(httpServer);

const server = httpServer.listen(PORT, () => {
  // Promote configured admin emails once the DB is reachable.
  setTimeout(() => bootstrapAdmin(), 1500);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\nError: Port ${PORT} is already in use.`);
    console.error(`💡 To fix this manually, you can run:`);
    console.error(
      `   Windows (PowerShell): Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force`,
    );
    console.error(`   Linux/macOS: kill -9 $(lsof -t -i:${PORT})`);
    console.error(`\nAttempting to automatically free port ${PORT}...`);

    try {
      const { execSync } = require("child_process");
      if (process.platform === "win32") {
        const pid = execSync(
          `powershell -Command "Get-NetTCPConnection -State Listen -LocalPort ${PORT} | Select-Object -First 1 -ExpandProperty OwningProcess"`,
          { encoding: "utf8" },
        ).trim();

        if (pid && !isNaN(pid) && pid !== "0") {
          console.log(
            `Killing process with PID ${pid} occupying port ${PORT}...`,
          );
          execSync(`taskkill /F /PID ${pid}`);
          console.log(`Port ${PORT} freed! Please restart the server.`);
        } else {
          console.log(
            `Could not identify the listening process on port ${PORT}.`,
          );
        }
      } else {
        execSync(`kill -9 $(lsof -t -i:${PORT})`);
        console.log(` Port ${PORT} freed! Please restart the server.`);
      }
    } catch (killError) {
      console.error(
        ` Could not automatically free port ${PORT}:`,
        killError.message,
      );
    }
    process.exit(1);
  } else {
    throw err;
  }
});
