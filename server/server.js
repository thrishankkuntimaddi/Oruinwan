require("dotenv").config();

// Logger first: env validation below logs before anything else is loaded.
const logger = require("./utils/logger");

const requiredEnvVars = [
  'MONGO_URI',
  'DATABASE_URL',   // identity, tasks, logs, embeddings and the event outbox live in PostgreSQL
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

// One codebase, several process shapes (all | api | realtime | worker); see src/shared/processRole.js
const processRole = require('./src/shared/processRole');
const { getRedis, createSubscriber, closeRedis, isRedisConfigured } = require('./src/shared/redis');
const { scheduleJob, stopAllJobs } = require('./src/shared/jobs/scheduler');
const { connectDatabase } = require('./src/shared/db');
const { connectPostgres, closePostgres } = require('./src/shared/postgres');
const { applyRetentionPolicies } = require('./src/shared/retentionIndexes');
const presenceService = require('./src/features/presence/presence.service');
let stopEventConsumers = async () => {};

logger.info(`🧩 Process role: ${processRole.role} (http=${processRole.serves.http} sockets=${processRole.serves.sockets} jobs=${processRole.serves.jobs})`);
for (const warning of processRole.roleWarnings()) logger.warn(`⚠️  ${warning}`);

const { generateAuditDigest } = require('./src/services/auditDigestService');

const registerSocketAuth = require('./src/socket/socketAuth');
const registerSocketConnection = require('./src/socket/socketConnection');

const { notFoundHandler, globalErrorHandler } = require('./src/shared/middleware/errorHandlers');

const app = express();

app.set("trust proxy", 1);

// Behind the TLS proxy every request says X-Forwarded-Proto: https. Health checks from the
// container runtime, and trying the server out on the same machine, stay on plain HTTP.
const PLAIN_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {

    if (req.headers['x-forwarded-proto'] !== 'https' && req.path !== '/api/health' && !PLAIN_HTTP_HOSTS.has(req.hostname)) {
      logger.info('⚠️ HTTP request detected, redirecting to HTTPS');
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Incoming integration webhooks are HMAC-signed over the exact request bytes,
// so the raw body is kept for /api/v2/integrations/webhook/* only.
const { captureRawBody } = require('./src/features/integrations/webhook.verify');
app.use(express.json({ limit: '50mb', verify: captureRawBody }));
app.use(express.urlencoded({ limit: '50mb', extended: true, verify: captureRawBody }));
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
  // Extra origins, comma-separated, e.g. the web app on another machine: http://100.64.0.10:3000
  ...(process.env.CORS_EXTRA_ORIGINS || '').split(',').map((o) => o.trim()),
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

if (!processRole.serves.http) {
  // worker: health checks only. storage: health + the upload/download routes only.
  const STORAGE_PATHS = /^\/(v2\/uploads|upload)(\/|$)/;
  app.use('/api', (req, res, next) => {
    if (processRole.serves.storage && STORAGE_PATHS.test(req.path)) return next();
    return res.status(503).json({ message: `Not served by this ${processRole.role} process`, role: processRole.role });
  });
}

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

if (isRedisConfigured()) {
  (async () => {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const pubClient = getRedis();
      const subClient = createSubscriber();
      if (!pubClient || !subClient) throw new Error('shared Redis client unavailable');

      io.adapter(createAdapter(pubClient, subClient));
      logger.success('✅ [REDIS] Socket.IO Redis adapter connected — horizontal scaling enabled');
      subClient.on('error', (err) => logger.error('❌ [REDIS] sub client error:', err.message));
    } catch (err) {
      logger.error('⚠️  [REDIS] Adapter init failed — falling back to in-memory adapter (single-instance only):', err.message);
    }
  })();
} else {
  logger.info('ℹ️  [REDIS] REDIS_URL not set — running with in-memory adapter (single-instance mode)');
}

if (!processRole.serves.sockets) {
  // api/worker nodes keep `io` for emitting through the adapter but never hold client sockets.
  io.use((socket, next) => next(new Error(`Realtime connections are not served by this ${processRole.role} process`)));
}

app.set("io", io);

const { setIO } = require('./src/socket/getIO');
setIO(io);

app.use((req, res, next) => {
  req.io = io;
  next();
});

const { requireFlag } = require("./src/shared/featureFlags");
app.use("/api/flags", require("./src/shared/featureFlags/routes"));

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
// Tool actions called back by the standalone AI service (bearer AI_SERVICE_TOKEN).
app.use('/api/internal/ai-actions', require('./src/features/ai/ai.internal.routes'));
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

// Domains that have moved to src/modules/<name> mount themselves (see src/modules/index.js).
const serverModules = require("./src/modules");
serverModules.registerModules({ app, io, requireAuth });


app.use("/api/v2/encryption", require("./src/modules/encryption/encryption.routes"));



app.use("/api/v2/identity", require("./src/modules/identity/identity.routes"));

app.use("/api/v2/conversations", require("./src/modules/conversations/conversationKeys.routes"));

app.use("/api/v2/crypto", require("./src/features/crypto/identity.routes"));

app.use("/api/v2/devices", require("./src/features/devices/devices.routes"));

// security.routes is mounted once at /api/company (see above); the /api/v2/security duplicate was removed.


app.use("/api/v2/tasks", require("./src/features/tasks/tasks.routes"));

app.use("/api/v2/notes", require("./src/features/notes/notes.routes"));

app.use("/api/v2/favorites", require("./src/features/favorites/favorites.routes"));

app.use('/api/public', require('./src/features/developer/publicApi.routes'));

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

app.use("/api/auth/sso", requireFlag("sso"), require("./src/features/security/sso.routes"));

app.use("/api/auth/2fa", require("./src/features/security/twoFactor.routes"));

app.use("/api/compliance", require("./src/features/security/gdpr.routes"));

app.use("/api/security", require("./src/features/security/backup.routes"));

app.use("/api/push", require("./routes/push.routes"));

app.use('/api/developer', require('./src/features/developer/apiKeys.routes'));

app.use('/api/developer', require('./src/features/developer/bots.routes'));

app.use('/api/developer', require('./src/features/developer/apps.routes'));

require('./src/features/developer/seedApps').seedApps();

app.use('/api/marketplace', require('./src/features/community/marketplace.routes'));

if (processRole.serves.sockets) {
  registerSocketAuth(io);
  registerSocketConnection(io);
  presenceService.startPresenceHeartbeat();
}

app.use('/api/scheduled-meetings', requireAuth, require('./src/features/meetings/scheduled-meetings.routes'));

// Single-origin deploys: any other page URL (a refresh on /workspace/…) loads the web app,
// whose router takes it from there. API paths and missing files still 404.
const WEB_INDEX = path.join(__dirname, '../dist/index.html');
const NOT_WEB_PATHS = /^\/(api|uploads|socket\.io)(\/|$)/;
app.get(/.*/, (req, res, next) => {
  if (NOT_WEB_PATHS.test(req.path) || path.extname(req.path) || !req.accepts('html')) return next();
  res.sendFile(WEB_INDEX, (err) => { if (err) next(); });
});

app.use(notFoundHandler);
app.use(globalErrorHandler); 

const PORT = process.env.PORT || 8080;

connectDatabase()
  .then(async () => {
    logger.success("MongoDB Connected ✔");

    // PostgreSQL (relational side). Off until DATABASE_URL is set; applies db/migrations on boot.
    const pg = await connectPostgres();

    // Rows from before UMEK envelopes were sealed: drop password-derived UMEKs, seal the rest.
    if (pg) {
      await require('./src/features/crypto/umekEnvelope').sealStoredUmeks()
        .catch((err) => logger.error('[CRYPTO] Could not seal stored UMEKs:', err.message));
    }

    // Object storage: make sure the bucket exists (S3 driver only).
    await require('./src/modules/uploads/upload.service').ensureBucket();

    // TTL indexes for the ever-growing log collections (no-op unless *_RETENTION_DAYS is set).
    await applyRetentionPolicies();

    // Modules may start cross-instance state sharing (huddles) on every role.
    serverModules.startModules({ io, jobs: processRole.serves.jobs });

    if (processRole.serves.jobs) {
      // Each job runs on one instance per interval fleet-wide (Redis lock in src/shared/jobs/scheduler.js).
      require('./src/features/reminders/reminders.cron').startRemindersCron(io);
      require('./src/features/tasks/tasks.cron').startRecurringTasksCron();
      require('./src/features/security/retention.cron').startRetentionCron();
      require('./src/features/automations/automation.cron').startAutomationCron(io);
      scheduleJob({
        name: 'audit-digest',
        intervalMs: 60 * 60 * 1000,
        initialDelayMs: 5000,
        run: generateAuditDigest,
      });
      logger.info('✅ [AUDIT][PHASE1] Digest scheduler active (runs every 60 minutes)');

      // Event bus: outbox -> Redis Stream relay, plus consumers (webhooks, ...). Jobs processes only.
      const events = require('./src/shared/events');
      events.startOutboxRelay();
      events.startEventConsumers().then((stop) => { stopEventConsumers = stop; })
        .catch((err) => logger.error('[EVENTS] consumers failed to start:', err.message));
    } else {
      logger.info(`ℹ️  [JOBS] Background jobs are not run by this ${processRole.role} process`);
    }

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
      logger.success(`Server (Express + Socket.IO) running on port ${PORT} as "${processRole.role}"`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
      require('./utils/sendEmail').logEmailConfigWarnings();
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
    stopAllJobs();
    await stopEventConsumers();

    // Tell the other instances this process's users are gone before the sockets close.
    await presenceService.releaseAllPresence();

    logger.info('🔌 [SHUTDOWN] Closing Socket.IO...');
    await new Promise((resolve) => io.close(resolve));
    logger.info('✅ [SHUTDOWN] Socket.IO closed');

    
    logger.info('🌐 [SHUTDOWN] Draining HTTP connections...');
    // io.close() already closed the HTTP server it was attached to; a second close is not an error.
    await new Promise((resolve, reject) => httpServer.close((err) => (err && err.code !== 'ERR_SERVER_NOT_RUNNING') ? reject(err) : resolve()));
    logger.info('✅ [SHUTDOWN] HTTP server drained');

    
    logger.info('🗄️  [SHUTDOWN] Disconnecting MongoDB...');
    await mongoose.disconnect();
    logger.info('✅ [SHUTDOWN] MongoDB disconnected');
    await closeRedis();
    await closePostgres();

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
