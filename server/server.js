require("dotenv").config();

// Logger first: env validation below logs before anything else is loaded.
const logger = require("./utils/logger");

const requiredEnvVars = [
  'MONGO_URI',
  'ACCESS_TOKEN_SECRET',
  'REFRESH_TOKEN_SECRET',
  'FRONTEND_URL',
  'GOOGLE_CLIENT_ID',
  'SERVER_KEK'  
];

logger.info('🔍 Validating environment variables...');
const missing = requiredEnvVars.filter(varName => !process.env[varName]);

if (missing.length > 0) {
  logger.error('❌ FATAL: Missing required environment variables:');
  missing.forEach(varName => logger.error(`   - ${varName}`));
  logger.error('\n💡 Check your .env file or deployment environment settings');
  logger.error('   Required variables:', requiredEnvVars.join(', '));
  process.exit(1);
}

logger.info('✅ All required environment variables present');

const serverKekHex = process.env.SERVER_KEK || '';
if (serverKekHex.length !== 64) {
  logger.error(`❌ FATAL: SERVER_KEK must be exactly 64 hex characters / 32 bytes for AES-256 (got ${serverKekHex.length})`);
  logger.error('   Generate a valid key with: node -e "require(\'crypto\').randomBytes(32).toString(\'hex\')"');
  process.exit(1);
}
logger.info(`✅ SERVER_KEK validated (64 hex chars = 32 bytes, AES-256 ready)`);
logger.info(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");
const passport = require("./config/passport");

const { generateAuditDigest } = require('./src/services/auditDigestService');

const registerSocketAuth = require('./src/socket/socketAuth');
const registerSocketConnection = require('./src/socket/socketConnection');

const { notFoundHandler, globalErrorHandler } = require('./src/shared/middleware/errorHandlers');

const app = express();

app.set("trust proxy", 1);

if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    
    if (req.headers['x-forwarded-proto'] !== 'https') {
      logger.info('⚠️ HTTP request detected, redirecting to HTTPS');
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(helmet());
app.use(passport.initialize());

const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8081',   // Expo web
  'http://localhost:19006',  // Expo web (classic)
  'http://localhost:19000',  // Expo DevTools
  process.env.FRONTEND_URL,
].filter(Boolean); 

logger.info('🌐 CORS allowed origins:', allowedOrigins);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

const { sanitizeInput } = require('./src/shared/middleware/validate');
app.use(sanitizeInput);
logger.info('🛡️ Input sanitization enabled');

const limiter = rateLimit({
  windowMs: 60 * 1000, 
  max: isProduction ? 20 : 100, 
  standardHeaders: true,
  legacyHeaders: false,
  
  
  skip: (req) => {
    const p = req.path;
    
    return p === '/me' || p.startsWith('/users');
  },
  
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many requests, please try again later.",
    });
  },
});
app.use("/api/auth", limiter);

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 60 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path !== '/refresh', 
  handler: (req, res) => {
    res.status(429).json({ message: "Too many token refresh requests, please try again later." });
  },
});
app.use("/api/auth", refreshLimiter);

app.use('/api/health', require('./src/shared/routes/health.routes'));

app.use(express.static(path.join(__dirname, "../dist")));

const requireAuth = require("./src/shared/middleware/auth");

const { requireOwner, requireAdmin, requireManager } = require("./src/shared/middleware/permissionMiddleware");

// Local-disk fallback for workspace files only (used when GCS is not configured).
// Verification documents and anything else under uploads/ are never served here.
const INLINE_UPLOAD_TYPES = /^(image\/(?!svg)|video\/|audio\/|application\/pdf)/;
app.use('/uploads/files', express.static(path.join(__dirname, 'uploads', 'files'), {
  index: false,
  dotfiles: 'deny',
  setHeaders: (res, filePath) => {
    const type = require('mime-types').lookup(filePath) || 'application/octet-stream';
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!INLINE_UPLOAD_TYPES.test(type)) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment');
    }
  },
}));

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

if (process.env.REDIS_URL) {
  (async () => {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { default: Redis } = require('ioredis');

      const pubClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,     
        enableReadyCheck: false,
        lazyConnect: true
      });
      const subClient = pubClient.duplicate();

      
      await pubClient.connect();
      await subClient.connect();

      io.adapter(createAdapter(pubClient, subClient));
      logger.success('✅ [REDIS] Socket.IO Redis adapter connected — horizontal scaling enabled');

      
      pubClient.on('error', (err) => logger.error('❌ [REDIS] pub client error:', err.message));
      subClient.on('error', (err) => logger.error('❌ [REDIS] sub client error:', err.message));
    } catch (err) {
      logger.error('⚠️  [REDIS] Adapter init failed — falling back to in-memory adapter (single-instance only):', err.message);
      
    }
  })();
} else {
  logger.info('ℹ️  [REDIS] REDIS_URL not set — running with in-memory adapter (single-instance mode)');
}

app.set("io", io);

const { setIO } = require('./src/socket/getIO');
setIO(io);

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use("/api/auth", require("./src/features/auth/auth.routes"));
app.use("/api/admin", require("./src/shared/middleware/auth"), require("./src/features/admin/admin.routes"));

app.use("/api/company/onboarding", require("./src/features/onboarding/onboarding.routes"));

app.use("/api/company", require("./src/features/security/security.routes")); 

// Integration router serves /scim/users* (SCIM Location headers use /api/scim/users) and
// /company/scim/tokens, /company/integrations/sync* — all reachable from the /api mount.
// The former duplicate /api/company mount only produced /api/company/company/* aliases.
const integrationRouter = require("./src/features/integration/integration.routes");
app.use("/api", integrationRouter);

app.use("/api/admin-dashboard", requireAuth, requireAdmin, require("./src/features/admin/admin-dashboard.routes"));
app.use("/api/owner-dashboard", requireAuth, requireOwner, require("./src/features/admin/owner-dashboard.routes"));

app.use("/api/manager-dashboard", requireAuth, requireManager, require("./src/features/admin/manager-dashboard.routes"));
app.use("/api/manager",           requireAuth, requireManager, require("./src/features/admin/manager-dashboard.routes"));

app.use("/api/polls", requireAuth, require("./src/features/polls/poll.routes")); 

app.use("/api/chat", requireAuth, require("./src/features/chatlist/chatlist.routes"));
app.use("/api/channels", require("./src/features/channels/channel.routes"));

app.use("/api/otp", require("./src/shared/routes/otp.routes"));

app.use("/api/companies", require("./src/features/company/company.routes"));
app.use("/api/companies", require("./src/features/company/settings.routes"));
app.use("/api/companies", require("./src/features/company/metrics.routes"));
app.use("/api/companies", require("./src/features/company-registration/registration.routes"));
app.use("/api/companies", require("./src/features/employees/employee.routes"));
app.use("/api/companies", require("./src/features/domain-verification/domain.routes"));
app.use("/api/departments", require("./src/features/departments/departments.routes"));

app.use("/api/workspace-templates", require("./src/features/workspace-templates/workspace-templates.routes"));
app.use("/api/teams", require("./src/features/teams/teams.routes"));
app.use("/api/companies", require("./src/features/company-org/org-chart.routes"));

app.use("/api/company", require("./src/features/people/people.routes"));
app.use("/api/company", require("./src/features/company-updates/updates.routes"));

app.use("/api/company", require("./src/features/company-analytics/analytics.routes"));

app.use("/api/workspaces", require("./src/features/workspaces/workspaces.routes"));

app.use("/api/workspace-os", require("./src/features/workspace-os/workspace-os.routes"));

app.use("/api/permissions", require("./src/features/permissions/permissions.routes"));

app.use("/api/compliance-logs", require("./src/features/compliance/compliance.routes"));

app.use("/api/platform/support", require("./src/features/support/platform-support.routes"));
app.use("/api/internal", require("./src/features/internal-messaging/messaging.routes"));

app.use("/api", require("./routes/v1-to-v2-proxy"));
app.use("/api/upload", require("./src/shared/upload/upload.routes")); 
app.use("/api/updates", require("./src/features/updates/updates.routes"));
app.use("/api/dashboard", require("./src/features/dashboard/dashboard.routes"));
app.use("/api/users", require("./src/features/users/user.routes"));
app.use("/api/search", require("./src/features/search/search.routes"));
app.use("/api/support", require("./src/features/support/support.routes"));
app.use("/api/managers", require("./src/features/managers/managers.routes"));
app.use("/api/analytics", require("./src/features/analytics/analytics.routes"));
app.use("/api/ai", require("./src/features/ai/ai.routes"));


app.use("/api/ai", requireAuth, require("./src/features/ai/assistant/ai-assistant.routes"));

app.use("/api/ai", requireAuth, require("./src/features/ai/knowledge/ai-knowledge.routes"));

app.use("/api/ai", requireAuth, require("./src/features/ai/automation/ai-automation.routes"));

app.use("/api/ai", requireAuth, require("./src/features/ai/insights/ai-insights.routes"));

app.use("/api/activity", require("./src/features/activity/activity.routes"));

app.use("/api/sprints", require("./src/features/sprints/sprints.routes"));
app.use("/api/milestones", require("./src/features/milestones/milestones.routes"));
app.use("/api/task-templates", require("./src/features/task-templates/task-templates.routes"));

app.use("/api/v2/messages", require("./src/modules/messages/messages.routes"));

app.use("/api/v2/dm", require("./src/modules/messages/dmActions.routes"));

app.use("/api/v2/encryption", require("./src/modules/encryption/encryption.routes"));

app.use("/api/threads", require("./src/modules/threads/threads.routes"));

app.use("/api/threads/v2", requireAuth, require("./src/modules/threads/threadsV2.routes"));

app.use("/api/v2/identity", require("./src/modules/identity/identity.routes"));

app.use("/api/v2/conversations", require("./src/modules/conversations/conversationKeys.routes"));

app.use("/api/v2/crypto", require("./src/features/crypto/identity.routes"));

app.use("/api/v2/devices", require("./src/features/devices/devices.routes"));

// security.routes is mounted once at /api/company (see above); the /api/v2/security duplicate was removed.

app.use('/api/notifications', require('./src/features/notifications/notifications.routes'));

app.use("/api/v2/tasks", require("./src/features/tasks/tasks.routes"));

app.use("/api/v2/notes", require("./src/features/notes/notes.routes"));

app.use("/api/v2/favorites", require("./src/features/favorites/favorites.routes"));

app.use('/api/public', require('./src/features/developer/publicApi.routes'));

app.use("/api/messages", requireAuth, require("./src/features/messages/bookmark.routes"));
// No blanket requireAuth here: every reminders route applies requireAuth itself, and a
// blanket middleware on "/api" would force auth on every later /api/* route.
app.use("/api", require("./src/features/reminders/reminders.routes"));

app.use("/api/v2/link-preview", require("./src/modules/linkPreview/linkPreview.routes"));

app.use("/api/v2/status", require("./src/features/status/status.routes"));

// admin.routes is mounted once at /api/admin (with requireAuth); the unauthenticated
// /api/v2/admin duplicate was removed (no client uses it).

app.use("/api/v2/audit", require("./src/features/audit/audit.routes"));

app.use("/api/v2/uploads", require("./src/modules/uploads/upload.routes"));

app.use("/api/v2/files", require("./src/features/files/files.routes"));
app.use("/api/v2/knowledge", require("./src/features/knowledge/knowledge.routes"));

app.use("/api/v2/meetings", require("./src/features/meetings/meetings.routes"));
app.use("/api/v2/collaboration", require("./src/features/collaboration/collaboration.routes"));

app.use("/api/v2/automations", requireAuth, require("./src/features/automations/automation.routes"));

app.use("/api/v2/integrations", require("./src/features/integrations/integrations.routes"));

app.use("/api/auth/sso", require("./src/features/security/sso.routes"));

app.use("/api/auth/2fa", require("./src/features/security/twoFactor.routes"));

app.use("/api/compliance", require("./src/features/security/gdpr.routes"));

app.use("/api/security", require("./src/features/security/backup.routes"));

app.use("/api/push", require("./routes/push.routes"));

app.use('/api/developer', require('./src/features/developer/apiKeys.routes'));

app.use('/api/developer', require('./src/features/developer/bots.routes'));

app.use('/api/developer', require('./src/features/developer/apps.routes'));

require('./src/features/developer/seedApps').seedApps();

app.use('/api/marketplace', require('./src/features/community/marketplace.routes'));

registerSocketAuth(io);       
registerSocketConnection(io); 

app.use('/api/scheduled-meetings', requireAuth, require('./src/features/meetings/scheduled-meetings.routes'));

app.use(notFoundHandler);    
app.use(globalErrorHandler); 

const PORT = process.env.PORT || 8080;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    logger.success("MongoDB Connected ✔");

    
    const { startRemindersCron } = require('./src/features/reminders/reminders.cron');
    startRemindersCron(io);

    
    const { startRecurringTasksCron } = require('./src/features/tasks/tasks.cron');
    startRecurringTasksCron();

    
    const { startNotificationsCron } = require('./src/features/notifications/notifications.cron');
    startNotificationsCron(io);

    
    const { startRetentionCron } = require('./src/features/security/retention.cron');
    startRetentionCron();

    
    const { startAutomationCron } = require('./src/features/automations/automation.cron');
    startAutomationCron(io);

    // A busy port is a config problem, not a crash: say so plainly and exit
    // without the uncaught-exception dump.
    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use. Stop the other process (lsof -i :${PORT}) or set PORT in server/.env.`);
        process.exit(1);
      }
      throw err;
    });

    httpServer.listen(PORT, () => {
      logger.success(`Server (Express + Socket.IO) running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`CORS allowed origins: ${allowedOrigins.join(', ')}`);

      
      
      
      logger.info('📊 [AUDIT][PHASE1] Scheduling hourly key distribution health checks');

      
      setTimeout(() => {
        logger.info('📊 [AUDIT][PHASE1] Running initial audit digest...');
        generateAuditDigest().catch(err => {
          logger.error('[AUDIT][PHASE1] Initial digest failed:', err);
        });
      }, 5000); 

      
      setInterval(() => {
        generateAuditDigest().catch(err => {
          logger.error('[AUDIT][PHASE1] Hourly digest failed:', err);
        });
      }, 60 * 60 * 1000); 

      logger.info('✅ [AUDIT][PHASE1] Digest scheduler active (runs every 60 minutes)');
      
    });

  })
  .catch((err) => {
    logger.error("MongoDB Connection Failed ❌", err);
    process.exit(1);
  });

async function shutdown(signal) {
  logger.info(`📴 [SHUTDOWN] ${signal} received — starting graceful shutdown`);

  
  const forceExit = setTimeout(() => {
    logger.error('❌ [SHUTDOWN] Drain timeout exceeded (30s) — forcing exit');
    process.exit(1);
  }, 30000);
  forceExit.unref(); 

  try {
    
    logger.info('🔌 [SHUTDOWN] Closing Socket.IO...');
    await new Promise((resolve) => io.close(resolve));
    logger.info('✅ [SHUTDOWN] Socket.IO closed');

    
    logger.info('🌐 [SHUTDOWN] Draining HTTP connections...');
    await new Promise((resolve, reject) => httpServer.close((err) => err ? reject(err) : resolve()));
    logger.info('✅ [SHUTDOWN] HTTP server drained');

    
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

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ [PROCESS] Unhandled Promise Rejection:', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined
  });
  
  if (isProduction) {
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  logger.error('❌ [PROCESS] Uncaught Exception - shutting down:', {
    error: err.message,
    stack: err.stack
  });
  
  process.exit(1);
});
