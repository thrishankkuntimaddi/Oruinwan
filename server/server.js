console.log("🚀 Server file loaded");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("MONGO_URI exists:", !!process.env.MONGO_URI);



// server/server.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");
const registerChatHandlers = require("./socket");
const logger = require("./utils/logger");

// Initialize app
const app = express();

app.set("trust proxy", 1);

// --- Middlewares ---
// Increase payload size limit for notes with media (images/videos/audio as base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(helmet());

// CORS - Allow development and production origins
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = [
  'http://localhost:3000', // Development
  process.env.FRONTEND_URL
].filter(Boolean);

// In production, only allow HTTPS origins
if (isProduction && allowedOrigins.includes('http://localhost:3000')) {
  const prodOnlyOrigins = allowedOrigins.filter(origin => !origin.includes('localhost'));
  allowedOrigins.length = 0;
  allowedOrigins.push(...prodOnlyOrigins);
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Rate limiting (protect auth endpoints)
// Use stricter limits in production
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isProduction ? 20 : 100, // Stricter in production
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for frequently-called endpoints
  skip: (req) => {
    const path = req.path;
    // Don't rate limit /me, /refresh, /users (used on every page load)
    return path === '/me' || path === '/refresh' || path === '/users';
  },
  // Return JSON instead of plain text
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many requests, please try again later.",
    });
  },
});
app.use("/api/auth", limiter);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => logger.success("MongoDB Connected ✔"))
  .catch((err) => logger.error("MongoDB Error ❌", err));

// Serve uploaded files as static files
app.use(express.static(path.join(__dirname, "../client/build")));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./middleware/auth"), require("./routes/admin")); // Protected by auth middleware first
app.use("/api/messages", require("./routes/messages"));
app.use("/api/chat", require("./routes/chatList"));
app.use("/api/channels", require("./routes/channels"));
app.use("/api/companies", require("./routes/companies"));
app.use("/api/departments", require("./routes/departments")); // NEW: Departments route
app.use("/api/workspaces", require("./routes/workspaces"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/notes", require("./routes/notes"));
app.use("/api/updates", require("./routes/updates"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/favorites", require("./routes/favorites"));
app.use("/api/users", require("./routes/user"));
app.use("/api/search", require("./routes/search"));
app.use("/api/search", require("./routes/search"));
app.use("/api/support", require("./routes/support")); // NEW: Support Tickets
app.use("/api/audit", require("./routes/audit")); // NEW: Audit Logs
app.use("/api/managers", require("./routes/managers")); // NEW: Manager Dashboard
app.use("/api/analytics", require("./routes/analytics")); // NEW: Analytics Dashboard




// ---------------------------------------------------------
// SOCKET.IO SETUP
// ---------------------------------------------------------

// Create HTTP server wrapper
const httpServer = http.createServer(app);

// Create Socket.io server
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Make io available to controllers
app.set("io", io);

// SOCKET AUTH (using Access Token)
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("No token"));
    }

    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    socket.user = { id: decoded.sub };
    next();
  } catch (err) {
    // Only log unexpected errors - token expiration is handled by client refresh
    if (err.name !== 'TokenExpiredError') {
      logger.error("SOCKET AUTH ERROR:", err);
    }
    next(new Error("Authentication failed"));
  }
});

// Register socket events
io.on("connection", (socket) => {
  logger.debug("User connected:", socket.user.id);

  registerChatHandlers(io, socket);
});

// ---------------------------------------------------------
// START SERVER
// ---------------------------------------------------------
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  logger.success(`Server (Socket.io + Express) running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
});
