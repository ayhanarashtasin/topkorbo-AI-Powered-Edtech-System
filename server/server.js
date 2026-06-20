const { execSync } = require("child_process");
const dns = require("node:dns");
const path = require("node:path");
const fs = require("node:fs");

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

    console.log("Using Atlas-friendly DNS servers:", atlasDnsServers);
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

// Load Passport Configuration
require("./config/passport");

const app = express();
const PORT = process.env.PORT || 5000;

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
app.use(express.json({ limit: "16mb" }));
app.use(express.urlencoded({ limit: "16mb", extended: true }));
app.use(passport.initialize());

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

// Health check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "TopKorbo API is running 🚀" });
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

const server = app.listen(PORT, () => {
  console.log(` TopKorbo Server running on port ${PORT}`);
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
