// server/server.js
// Production entrypoint for Node.js backend (Cloud Run, Railway, or any platform)
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
  console.error('\n💡 Check your .env file or deployment environment settings');
  console.error('   Required variables:', requiredEnvVars.join(', '));
  process.exit(1);
}

console.log('✅ All required environment variables present');

// Validate SERVER_KEK is a valid 256-bit (32-byte / 64-char hex) key
const serverKekHex = process.env.SERVER_KEK || '';
if (serverKekHex.length !== 64) {
  console.error(`❌ FATAL: SERVER_KEK must be exactly 64 hex characters / 32 bytes for AES-256 (got ${serverKekHex.length})`);
  console.error('   Generate a valid key with: node -e "require(\'crypto\').randomBytes(32).toString(\'hex\')"');
  process.exit(1);
}
console.log(`✅ SERVER_KEK validated (64 hex chars = 32 bytes, AES-256 ready)`);
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

// ——————————————————————————————————————————————————————————————————
const { generateAuditDigest } = require('./src/services/auditDigestService');
// ——————————————————————————————————————————————————————————————————


// Initialize app
const app = express();

app.set("trust proxy", 1);

// Force HTTPS in production (for reverse proxy environments)
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
  'http://localhost:5173',         // Vite dev server default port
  'https://chttrix.vercel.app',   // production frontend
  process.env.FRONTEND_URL,       // dynamic: covers Vercel preview + staging URLs
].filter(Boolean); // remove undefined/null if FRONTEND_URL is not set

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
  // Skip rate limiting for frequently-called read-only endpoints
  // NOTE: /refresh is intentionally NOT skipped — it has its own dedicated limiter below
  skip: (req) => {
    const p = req.path;
    // Don't rate limit /me, /users (used on every page load)
    return p === '/me' || p.startsWith('/users');
  },
  // Return JSON instead of plain text
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many requests, please try again later.",
    });
  },
});
app.use("/api/auth", limiter);

// SECURITY FIX (BUG-10): Dedicated rate limiter for the /refresh endpoint.
// Previously /refresh was in the skip list — meaning zero throttling, enabling DoS.
// 60/min allows legitimate proactive token renewal while blocking flood attacks.
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 60 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path !== '/refresh', // Only apply to /refresh
  handler: (req, res) => {
    res.status(429).json({ message: "Too many token refresh requests, please try again later." });
  },
});
app.use("/api/auth", refreshLimiter);

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
app.use(express.static(path.join(__dirname, "../dist")));

// Serve uploaded files with authentication check
const requireAuth = require("./middleware/auth");
// SECURITY FIX (H-2): Import role middleware for dashboard mount-level guards.
// Defence-in-depth: role is enforced here so any new route added to these files
// is automatically protected, even if the developer forgets to add per-route middleware.
const { requireOwner, requireAdmin, requireManager } = require("./middleware/permissionMiddleware");
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

// ---------------------------------------------------------
// SOCKET.IO REDIS ADAPTER (horizontal scaling)
// Only activates when REDIS_URL is set.
// Falls back to default in-memory adapter if Redis is unavailable.
// ---------------------------------------------------------
if (process.env.REDIS_URL) {
  (async () => {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { default: Redis } = require('ioredis');

      const pubClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,     // Required for blocking commands
        enableReadyCheck: false,
        lazyConnect: true
      });
      const subClient = pubClient.duplicate();

      // Connect both clients before handing to adapter
      await pubClient.connect();
      await subClient.connect();

      io.adapter(createAdapter(pubClient, subClient));
      logger.success('✅ [REDIS] Socket.IO Redis adapter connected — horizontal scaling enabled');

      // Propagate Redis errors without crashing the process
      pubClient.on('error', (err) => logger.error('❌ [REDIS] pub client error:', err.message));
      subClient.on('error', (err) => logger.error('❌ [REDIS] sub client error:', err.message));
    } catch (err) {
      logger.error('⚠️  [REDIS] Adapter init failed — falling back to in-memory adapter (single-instance only):', err.message);
      // Server continues normally; only cross-instance event routing is unavailable
    }
  })();
} else {
  logger.info('ℹ️  [REDIS] REDIS_URL not set — running with in-memory adapter (single-instance mode)');
}

app.set("io", io);

// ✅ CRITICAL: Middleware to attach Socket.io to request object for controllers
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use("/api/auth", require("./src/features/auth/auth.routes"));
app.use("/api/admin", require("./middleware/auth"), require("./src/features/admin/admin.routes"));
app.use("/api/admin", require("./middleware/auth"), require("./src/features/onboarding/onboarding.routes")); // Employee onboarding
// SECURITY FIX (H-2): Role middleware applied at mount level (defence-in-depth on top of per-route guards).
// requireAuth  → rejects unauthenticated requests before they reach any route handler.
// requireOwner / requireAdmin / requireManager → rejects under-privileged authenticated users.
// This guarantees that every current AND future route in these files is role-gated,
// even if a developer forgets to add middleware to a new route handler.
app.use("/api/admin-dashboard", requireAuth, requireAdmin, require("./src/features/admin/admin-dashboard.routes"));
app.use("/api/owner-dashboard", requireAuth, requireOwner, require("./src/features/admin/owner-dashboard.routes"));
app.use("/api/manager-dashboard", requireAuth, requireManager, require("./src/features/admin/manager-dashboard.routes"));
app.use("/api/manager", requireAuth, requireManager, require("./src/features/admin/manager-dashboard.routes"));

app.use("/api/polls", requireAuth, require("./src/features/polls/poll.routes")); // SECURITY FIX (BUG-2): requireAuth added at mount level
app.use("/api/chat", require("./src/features/chatlist/chatlist.routes"));
app.use("/api/channels", require("./src/features/channels/channel.routes"));


// ============================================================================
// MODULAR ROUTES (Phase 2: Domain Separation Complete)
// ============================================================================
// OTP (shared service)
app.use("/api/otp", require("./src/shared/routes/otp.routes"));
// Company domain routes
app.use("/api/companies", require("./src/features/company/company.routes"));
app.use("/api/companies", require("./src/features/company/settings.routes"));
app.use("/api/companies", require("./src/features/company/metrics.routes"));
app.use("/api/companies", require("./src/features/company-registration/registration.routes"));
app.use("/api/companies", require("./src/features/employees/employee.routes"));
app.use("/api/companies", require("./src/features/domain-verification/domain.routes"));
app.use("/api/departments", require("./src/features/departments/departments.routes"));
app.use("/api/workspaces", require("./src/features/workspaces/workspaces.routes"));
app.use("/api/platform/support", require("./src/features/support/platform-support.routes"));
app.use("/api/internal", require("./src/features/internal-messaging/messaging.routes"));
// V1 COMPATIBILITY LAYER - Proxies v1 calls to v2 controllers (DELETE after client migration)
app.use("/api", require("./routes/v1-to-v2-proxy"));
app.use("/api/upload", require("./src/shared/upload/upload.routes")); // File upload routes
app.use("/api/updates", require("./src/features/updates/updates.routes"));
app.use("/api/dashboard", require("./src/features/dashboard/dashboard.routes"));
app.use("/api/users", require("./src/features/users/user.routes"));
app.use("/api/search", require("./src/features/search/search.routes"));
app.use("/api/support", require("./src/features/support/support.routes"));
app.use("/api/managers", require("./src/features/managers/managers.routes"));
app.use("/api/analytics", require("./src/features/analytics/analytics.routes"));
app.use("/api/ai", require("./src/features/ai/ai.routes"));
// Notes & Tasks - Direct registration (no proxy needed)
app.use("/api/notes", require("./src/features/notes/notes.routes")); // Direct routing, Phase 5 E2EE ready
app.use("/api/tasks", require("./src/features/tasks/tasks.routes")); // Direct routing, simplified architecture


// =============================================================
// 🔥 NEW MODULAR ROUTES (Active as of Week 2)
// ============================================================================
// ✅ V2 ROUTES (NEW MODULAR ARCHITECTURE)
// ============================================================================
// Modular, domain-driven routes with clean separation
app.use("/api/v2/messages", require("./src/modules/messages/messages.routes"));

// DM contact option actions (clear, delete, block, mute)
app.use("/api/v2/dm", require("./src/modules/messages/dmActions.routes"));

// E2EE Infrastructure
app.use("/api/v2/encryption", require("./src/modules/encryption/encryption.routes"));

// Threads (messaging threads)
app.use("/api/threads", require("./src/modules/threads/threads.routes"));

// Identity & Public Key Management
app.use("/api/v2/identity", require("./src/modules/identity/identity.routes"));

// Conversation Keys (E2EE-specific)
app.use("/api/v2/conversations", require("./src/modules/conversations/conversationKeys.routes"));

// Crypto Identity (UMEK-based recovery)
app.use("/api/v2/crypto", require("./src/features/crypto/identity.routes"));

// Device Sessions (Phase 3: device awareness and revocation)
app.use("/api/v2/devices", require("./src/features/devices/devices.routes"));

// Security Audit Log (Phase 4A: observability)
app.use("/api/v2/security", require("./src/features/security/security.routes"));

// Notifications (user inbox)
app.use('/api/notifications', require('./src/features/notifications/notifications.routes'));

// Tasks (Migrated from legacy)
app.use("/api/v2/tasks", require("./src/features/tasks/tasks.routes"));

// Notes (Migrated from legacy)
app.use("/api/v2/notes", require("./src/features/notes/notes.routes"));

// Favorites (Migrated from legacy)
app.use("/api/v2/favorites", require("./src/features/favorites/favorites.routes"));

// Phase 7.5 — Link Preview (SSRF-safe OG scraper)
app.use("/api/v2/link-preview", require("./src/modules/linkPreview/linkPreview.routes"));

// Status (Migrated from legacy) - PUBLIC endpoint
app.use("/api/v2/status", require("./src/features/status/status.routes"));

// Admin (Migrated from legacy) - ADMIN-ONLY endpoints
app.use("/api/v2/admin", require("./src/features/admin/admin.routes"));

// Audit (Migrated from legacy)
app.use("/api/v2/audit", require("./src/features/audit/audit.routes"));

// Phase 7.1: File / Image / Video Uploads (GCS via ADC)
app.use("/api/v2/uploads", require("./src/modules/uploads/upload.routes"));

// ============================================================================
// 📦 V1 ROUTES (LEGACY - TO BE MIGRATED)
// ============================================================================
// - These routes should be gradually migrated to /api/v2
// - New code should use /api/v2/* endpoints
// - Migration complete: all traffic now served by /api/v2/messages
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

  // Each user joins their own private room for targeted notifications
  socket.join(`user:${socket.user.id}`);

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
// SCHEDULED MEETINGS API (inline — lightweight, no separate router file)
// ---------------------------------------------------------
const ScheduledMeeting = require('./src/models/ScheduledMeeting');

// GET /api/scheduled-meetings?workspaceId=xxx  — upcoming meetings
app.get('/api/scheduled-meetings', requireAuth, async (req, res) => {
  try {
    const { workspaceId, limit = 10 } = req.query;
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });

    const now = new Date();
    const meetings = await ScheduledMeeting.find({
      workspaceId,
      startTime: { $gte: now },
      status: { $in: ['scheduled', 'live'] },
    })
      .sort({ startTime: 1 })
      .limit(Number(limit))
      .populate('createdBy', 'username firstName lastName avatarUrl')
      .lean();

    res.json({ meetings });
  } catch (err) {
    logger.error('GET /api/scheduled-meetings error:', err);
    res.status(500).json({ message: 'Failed to fetch meetings' });
  }
});

// POST /api/scheduled-meetings  — create a new scheduled meeting
app.post('/api/scheduled-meetings', requireAuth, async (req, res) => {
  try {
    const { workspaceId, channelId, dmSessionId, title, startTime, duration, meetingLink, participants } = req.body;
    if (!workspaceId || !title || !startTime) {
      return res.status(400).json({ message: 'workspaceId, title, and startTime are required' });
    }

    const meeting = await ScheduledMeeting.create({
      workspaceId,
      channelId: channelId || null,
      dmSessionId: dmSessionId || null,
      createdBy: req.user.sub,
      title: title.trim(),
      startTime: new Date(startTime),
      duration: duration || 30,
      meetingLink: meetingLink || null,
      participants: participants || [],
      status: 'scheduled',
    });

    const populated = await meeting.populate('createdBy', 'username firstName lastName avatarUrl');

    // Broadcast to workspace so all HomePanel sidebars refresh
    req.io.to(`workspace:${workspaceId}`).emit('schedule:created', { meeting: populated });

    // Create notifications for all workspace members
    try {
      const notifService = require('./src/features/notifications/notificationService');
      const WorkspaceModel = require('./src/features/workspaces/workspace.model');
      const ws = await WorkspaceModel.findById(workspaceId).select('members').lean();
      if (ws && ws.members) {
        const recipientIds = ws.members
          .map(m => (m.user || m).toString())
          .filter(id => id !== req.user.sub.toString());
        await notifService.scheduleCreated(req.io, {
          recipientIds,
          workspaceId,
          title: meeting.title,
          scheduledMeetingId: meeting._id,
        });
      }
    } catch (notifErr) {
      logger.error('Notification error on schedule create:', notifErr.message);
    }

    res.status(201).json({ meeting: populated });
  } catch (err) {
    logger.error('POST /api/scheduled-meetings error:', err);
    res.status(500).json({ message: 'Failed to create meeting' });
  }
});

// PATCH /api/scheduled-meetings/:id  — update status (cancel/complete/live)
app.patch('/api/scheduled-meetings/:id', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const VALID_STATUSES = ['scheduled', 'live', 'completed', 'cancelled'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const meeting = await ScheduledMeeting.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('createdBy', 'username firstName lastName avatarUrl');

    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    req.io.to(`workspace:${meeting.workspaceId}`).emit('schedule:updated', { meeting });

    res.json({ meeting });
  } catch (err) {
    logger.error('PATCH /api/scheduled-meetings/:id error:', err);
    res.status(500).json({ message: 'Failed to update meeting' });
  }
});

// DELETE /api/scheduled-meetings/:id
app.delete('/api/scheduled-meetings/:id', requireAuth, async (req, res) => {
  try {
    const meeting = await ScheduledMeeting.findByIdAndDelete(req.params.id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    req.io.to(`workspace:${meeting.workspaceId}`).emit('schedule:deleted', { meetingId: meeting._id });

    res.json({ message: 'Meeting deleted' });
  } catch (err) {
    logger.error('DELETE /api/scheduled-meetings/:id error:', err);
    res.status(500).json({ message: 'Failed to delete meeting' });
  }
});

// ---------------------------------------------------------
// ERROR HANDLERS (MUST BE AFTER ALL ROUTES)
// ---------------------------------------------------------

// 404 Handler - catch routes that don't exist
app.use((req, res) => {
  console.log('❌ [404] Route not found:', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    headers: req.headers['authorization'] ? 'Has Auth' : 'No Auth'
  });
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
    // ⚠️ SECURITY: Never log req.body - may contain passwords or tokens
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
    // NOTE: err.details may expose internals - omit sensitive fields in non-prod too
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

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PHASE 1 AUDIT: Schedule hourly digest reports
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      logger.info('📊 [AUDIT][PHASE1] Scheduling hourly key distribution health checks');

      // Run immediately on startup
      setTimeout(() => {
        logger.info('📊 [AUDIT][PHASE1] Running initial audit digest...');
        generateAuditDigest().catch(err => {
          logger.error('[AUDIT][PHASE1] Initial digest failed:', err);
        });
      }, 5000); // Wait 5 seconds for DB to stabilize

      // Then run every hour
      setInterval(() => {
        generateAuditDigest().catch(err => {
          logger.error('[AUDIT][PHASE1] Hourly digest failed:', err);
        });
      }, 60 * 60 * 1000); // 1 hour in milliseconds

      logger.info('✅ [AUDIT][PHASE1] Digest scheduler active (runs every 60 minutes)');
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    });

  })
  .catch((err) => {
    logger.error("MongoDB Connection Failed ❌", err);
    process.exit(1);
  });

// ---------------------------------------------------------
// GRACEFUL SHUTDOWN
// Handles SIGTERM (Railway/Docker deploy) and SIGINT (Ctrl+C)
// Order: stop accepting → close Socket.IO → drain HTTP → disconnect Mongo
// ---------------------------------------------------------
async function shutdown(signal) {
  logger.info(`📴 [SHUTDOWN] ${signal} received — starting graceful shutdown`);

  // Force-exit if drain takes longer than 30 seconds
  const forceExit = setTimeout(() => {
    logger.error('❌ [SHUTDOWN] Drain timeout exceeded (30s) — forcing exit');
    process.exit(1);
  }, 30000);
  forceExit.unref(); // Don't let this timer keep the process alive on its own

  try {
    // 1. Stop Socket.IO from accepting new connections and close all sockets
    logger.info('🔌 [SHUTDOWN] Closing Socket.IO...');
    await new Promise((resolve) => io.close(resolve));
    logger.info('✅ [SHUTDOWN] Socket.IO closed');

    // 2. Stop HTTP server from accepting new requests; wait for in-flight to finish
    logger.info('🌐 [SHUTDOWN] Draining HTTP connections...');
    await new Promise((resolve, reject) => httpServer.close((err) => err ? reject(err) : resolve()));
    logger.info('✅ [SHUTDOWN] HTTP server drained');

    // 3. Disconnect MongoDB cleanly
    logger.info('🗄️  [SHUTDOWN] Disconnecting MongoDB...');
    await mongoose.disconnect();
    logger.info('✅ [SHUTDOWN] MongoDB disconnected');

    clearTimeout(forceExit);
    logger.info('✅ [SHUTDOWN] Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('❌ [SHUTDOWN] Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ---------------------------------------------------------
// PROCESS-LEVEL CRASH GUARDS
// Prevent silent crashes from unhandled promise rejections
// ---------------------------------------------------------
process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ [PROCESS] Unhandled Promise Rejection:', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined
  });
  // Don't exit in development; do exit in production after logging
  if (isProduction) {
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  logger.error('❌ [PROCESS] Uncaught Exception - shutting down:', {
    error: err.message,
    stack: err.stack
  });
  // Always exit on uncaught exceptions - state is undefined
  process.exit(1);
});
