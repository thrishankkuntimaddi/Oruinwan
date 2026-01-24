// server/server.js
// CRITICAL: Validate environment variables FIRST before loading anything else
require("dotenv").config();

// Validate required environment variables
const requiredEnvVars = [
  'MONGO_URI',
  'ACCESS_TOKEN_SECRET',
  'REFRESH_TOKEN_SECRET',
  'FRONTEND_URL',
  'GOOGLE_CLIENT_ID',
  'SERVER_KEK'  // Server Key Encryption Key for E2EE workspace key decryption
];

console.log('🔍 Validating environment variables...');
const missing = requiredEnvVars.filter(varName => !process.env[varName]);

if (missing.length > 0) {
  console.error('❌ FATAL: Missing required environment variables:');
  missing.forEach(varName => console.error(`   - ${varName}`));
  console.error('\n💡 Check your .env file or Railway environment settings');
  console.error('   Required variables:', requiredEnvVars.join(', '));
  process.exit(1);
}

console.log('✅ All required environment variables present');
console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);

// Now safe to load modules
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");
const registerChatHandlers = require("./socket/index");
const logger = require("./utils/logger");
const passport = require("./config/passport");
const User = require("./models/User"); // ✅ Add User model import

// Initialize app
const app = express();

app.set("trust proxy", 1);

// Force HTTPS in production (for Railway proxy)
// This ensures sameSite:'none' cookies work properly
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Check if request came through as HTTP (from proxy perspective)
    if (req.headers['x-forwarded-proto'] !== 'https') {
      console.log('⚠️ HTTP request detected, redirecting to HTTPS');
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// --- Middlewares ---
// Increase payload size limit for notes with media (images/videos/audio as base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(helmet());
app.use(passport.initialize());

// CORS - Simple and reliable
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = [
  'http://localhost:3000',
  'https://chttrix.vercel.app'
];

console.log('🌐 CORS allowed origins:', allowedOrigins);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Input sanitization - CRITICAL SECURITY
// Prevents MongoDB injection attacks by removing $ operators
const { sanitizeInput } = require('./middleware/validate');
app.use(sanitizeInput);
console.log('🛡️ Input sanitization enabled');

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

// Health check endpoint for production monitoring
app.get('/api/health', async (req, res) => {
  try {
    // Check MongoDB connection status
    const dbStatus = mongoose.connection.readyState;
    const dbStatusMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    if (dbStatus !== 1) {
      return res.status(503).json({
        status: 'unhealthy',
        mongodb: dbStatusMap[dbStatus] || 'unknown',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      status: 'healthy',
      mongodb: 'connected',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Health check failed:', err);
    res.status(503).json({
      status: 'unhealthy',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Serve uploaded files as static files (with authentication for uploads)
app.use(express.static(path.join(__dirname, "../client/build")));

// Serve uploaded files with authentication check
const requireAuth = require("./middleware/auth");
app.use('/uploads', requireAuth, express.static(path.join(__dirname, 'uploads')));

// ---------------------------------------------------------
// SOCKET.IO SETUP (MUST BE BEFORE ROUTES)
// ---------------------------------------------------------
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

// ✅ CRITICAL: Middleware to attach Socket.io to request object for controllers
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./middleware/auth"), require("./routes/admin"));
app.use("/api/admin-dashboard", require("./routes/adminDashboard"));
app.use("/api/owner-dashboard", require("./routes/ownerDashboard"));
app.use("/api/manager-dashboard", require("./routes/managerDashboard")); // Old pattern
app.use("/api/manager", require("./routes/managerDashboard")); // New pattern - supports /api/manager/dashboard/*
app.use("/api/messages", require("./routes/messages"));
app.use("/api/polls", require("./routes/polls")); // Poll routes
app.use("/api/chat", require("./routes/chatList"));
app.use("/api/channels", require("./routes/channels"));
app.use("/api/companies", require("./routes/companies"));
app.use("/api/departments", require("./routes/departments"));
app.use("/api/workspaces", require("./routes/workspaces"));
app.use("/api/platform/support", require("./routes/platformSupport"));
app.use("/api/internal", require("./routes/internalMessaging"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/notes", require("./routes/notes"));
app.use("/api/upload", require("./routes/upload")); // File upload routes
app.use("/api/updates", require("./routes/updates"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/favorites", require("./routes/favorites"));
app.use("/api/users", require("./routes/user"));
app.use("/api/search", require("./routes/search"));
app.use("/api/support", require("./routes/support"));
app.use("/api/audit", require("./routes/audit"));
app.use("/api/managers", require("./routes/managers"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/ai", require("./routes/aiRoutes"));
app.use("/api/keys", require("./routes/keys")); // E2EE key management (legacy)
app.use("/api/status", require("./routes/statusRoutes")); // System health status


// =============================================================
// 🔥 NEW MODULAR ROUTES (Active as of Week 2)
// =============================================================
// These routes use the new domain-driven module architecture
// located in src/modules/*
// Legacy routes above still work for backward compatibility

// Messages Module - Clean architecture with E2EE support
app.use("/api/v2/messages", require("./src/modules/messages/messages.routes"));

// Encryption Module - First-class E2EE key management
app.use("/api/v2/encryption", require("./src/modules/encryption/encryption.routes"));

// Identity Module - User identity key management for E2EE
app.use("/api/v2/identity", require("./src/modules/identity/identity.routes"));

// Conversations Module - Conversation key management for E2EE
app.use("/api/v2/conversations", require("./src/modules/conversations/conversationKeys.routes"));

// ✅ Module routes are now ACTIVE
// - New code should use /api/v2/* endpoints
// - Legacy /api/messages and /api/keys still work
// - Gradual migration in progress
// =============================================================

// SOCKET AUTH (using Access Token)
const jwt = require("jsonwebtoken");

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      console.log('❌ Socket auth: No token provided');
      return next(new Error("No token"));
    }

    console.log('🔐 Socket auth: Verifying token...');
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log('✅ Socket auth: Token valid for user:', decoded.sub);
    socket.user = { id: decoded.sub };
    next();
  } catch (err) {
    console.error('❌ Socket auth error:', err.name, '-', err.message);
    if (err.name === 'TokenExpiredError') {
      console.log('⏰ Token expired at:', err.expiredAt);
    }
    next(new Error("Authentication failed"));
  }
});

io.on("connection", async (socket) => {
  logger.debug("Socket connected:", socket.user.id);

  // ✅ Set user online status
  try {
    await User.findByIdAndUpdate(socket.user.id, {
      isOnline: true,
      lastLoginAt: new Date()
    });

    // Broadcast status change to all connected clients
    io.emit("user-status-changed", {
      userId: socket.user.id,
      status: "active"
    });
  } catch (err) {
    logger.error("Error setting user online:", err);
  }

  registerChatHandlers(io, socket);
});

// ---------------------------------------------------------
// ERROR HANDLERS (MUST BE AFTER ALL ROUTES)
// ---------------------------------------------------------

// 404 Handler - catch routes that don't exist
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    suggestion: 'Check the API documentation for available endpoints'
  });
});

// Global Error Handler - catches all unhandled errors
app.use((err, req, res, next) => {
  // Log error with context for debugging
  logger.error('Global error handler:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: req.user?.sub,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Construct error response
  const errorResponse = {
    error: statusCode === 500 ? 'Internal Server Error' : (err.name || 'Error'),
    message: isProduction && statusCode === 500
      ? 'An unexpected error occurred. Please try again later.'
      : err.message
  };

  // Add stack trace in development only
  if (!isProduction) {
    errorResponse.stack = err.stack;
    errorResponse.details = err;
  }

  res.status(statusCode).json(errorResponse);
});

// ---------------------------------------------------------
// START SERVER (ONLY AFTER MONGO CONNECTS)
// ---------------------------------------------------------
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    logger.success("MongoDB Connected ✔");

    httpServer.listen(PORT, () => {
      logger.success(`Server (Express + Socket.IO) running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
    });
  })
  .catch((err) => {
    logger.error("MongoDB Connection Failed ❌", err);
    process.exit(1);
  });

