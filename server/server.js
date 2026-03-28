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
const logger = require("./utils/logger");
const passport = require("./config/passport");

// ——————————————————————————————————————————————————————————————————
const { generateAuditDigest } = require('./src/services/auditDigestService');
// Socket modules (Phase 4: extracted from server.js)
const registerSocketAuth = require('./src/socket/socketAuth');
const registerSocketConnection = require('./src/socket/socketConnection');
// Error handling middleware — Phase 5: canonical location
const { notFoundHandler, globalErrorHandler } = require('./src/shared/middleware/errorHandlers');
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
  process.env.FRONTEND_URL,       // covers production + preview + staging URLs
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
const { sanitizeInput } = require('./src/shared/middleware/validate');
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
app.use('/api/health', require('./src/shared/routes/health.routes'));

// Serve uploaded files as static files (with authentication for uploads)
app.use(express.static(path.join(__dirname, "../dist")));

// Serve uploaded files with authentication check
// Phase 5: canonical shared middleware
const requireAuth = require("./src/shared/middleware/auth");
// SECURITY FIX (H-2): Import role middleware for dashboard mount-level guards.
// Defence-in-depth: role is enforced here so any new route added to these files
// is automatically protected, even if the developer forgets to add per-route middleware.
const { requireOwner, requireAdmin, requireManager } = require("./src/shared/middleware/permissionMiddleware");
// GAP 1 FIX: Serve local upload fallback files publicly so browser can load
// file preview URLs (e.g. <img src="/uploads/files/uuid.png">) without auth headers.
// UUIDs in filenames prevent enumeration; no sensitive data is exposed.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Register IO singleton for use in feature modules (avoids circular deps)
const { setIO } = require('./src/socket/getIO');
setIO(io);

// ✅ CRITICAL: Middleware to attach Socket.io to request object for controllers
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use("/api/auth", require("./src/features/auth/auth.routes"));
app.use("/api/admin", require("./src/shared/middleware/auth"), require("./src/features/admin/admin.routes"));
// Employee Onboarding — STABILIZED (Phase 1 middleware applied within route file)
// Old: app.use("/api/admin", ..legacy middleware.., onboarding.routes)  ← bypassed Phase 1
// New: /api/company/onboarding — requireAuth + requireCompanyMember + requireCompanyRole('admin')
app.use("/api/company/onboarding", require("./src/features/onboarding/onboarding.routes"));

// Phase 2 — Company Communication Layer (canonical mounts at lines 313-316 below)
// Phase 3 — Company Security Layer
app.use("/api/company", require("./src/features/security/security.routes")); // /api/company/security/*, /api/company/audit-logs

// Phase 4 — Enterprise Integration Layer (S-20: split into two distinct mounts)
// Previously the same router was mounted twice, creating /api/scim AND /api/company paths
// from one file — a maintenance landmine. Now split cleanly:
//
//   scimRouter       → /api/scim/users           (SCIM Bearer token auth)
//   integrationRouter → /api/company/scim/tokens  (standard admin gate)
//                        /api/company/integrations/*

const integrationRouter = require("./src/features/integration/integration.routes");
app.use("/api", integrationRouter);           // S-20: mounts /api/scim/... routes only
app.use("/api/company", integrationRouter);  // S-20: mounts /api/company/scim/... and /api/company/integrations/...

// SECURITY FIX (H-2): Role middleware applied at mount level (defence-in-depth on top of per-route guards).
// requireAuth  → rejects unauthenticated requests before they reach any route handler.
// requireOwner / requireAdmin / requireManager → rejects under-privileged authenticated users.
// This guarantees that every current AND future route in these files is role-gated,
// even if a developer forgets to add middleware to a new route handler.
app.use("/api/admin-dashboard", requireAuth, requireAdmin, require("./src/features/admin/admin-dashboard.routes"));
app.use("/api/owner-dashboard", requireAuth, requireOwner, require("./src/features/admin/owner-dashboard.routes"));
// AREA 4 — ROUTE STANDARDIZATION NOTE (Phase 3 consistency audit):
// The same manager-dashboard router is intentionally mounted at TWO paths.
// Both are actively consumed by different client modules:
//
//   /api/manager-dashboard  ← used by: ManagerWorkspacePage, ManagerProjects, TeamAllocation,
//                                        managerDashboardService.js (my-workspaces, team-load)
//   /api/manager            ← used by: ManagerReports, ManagerTasks, ManagerOverview
//                                        (dashboard/metrics/:id, tasks/:id)
//
// ⚠️  DO NOT remove either mount until ALL client callers are migrated to a single path.
// Canonical target: /api/manager-dashboard (matches domain semantics).
// TODO: Migrate ManagerReports, ManagerTasks, ManagerOverview to /api/manager-dashboard
//       then remove the /api/manager mount.
app.use("/api/manager-dashboard", requireAuth, requireManager, require("./src/features/admin/manager-dashboard.routes"));
app.use("/api/manager",           requireAuth, requireManager, require("./src/features/admin/manager-dashboard.routes"));

app.use("/api/polls", requireAuth, require("./src/features/polls/poll.routes")); // SECURITY FIX (BUG-2): requireAuth added at mount level
// S-10 SECURITY FIX: requireAuth added at /api/chat mount level.
// Previously relied on per-route auth inside chatlist.routes.js (single-layer defence).
// Defence-in-depth: any authenticated request must pass JWT validation before reaching any chat route.
app.use("/api/chat", requireAuth, require("./src/features/chatlist/chatlist.routes"));
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

// ── WORKSPACE COLLABORATION EXTENSIONS ──────────────────────────────────────
// Phase 2: Workspace Management + Org Structure + Permissions
app.use("/api/workspace-templates", require("./src/features/workspace-templates/workspace-templates.routes"));
app.use("/api/teams", require("./src/features/teams/teams.routes"));
app.use("/api/companies", require("./src/features/company-org/org-chart.routes"));
// ─────────────────────────────────────────────────────────────────────────────

// Phase 3 — People Management + Phase 5 — Company Updates Feed
app.use("/api/company", require("./src/features/people/people.routes"));
app.use("/api/company", require("./src/features/company-updates/updates.routes"));
// Phase 6 — Company Analytics
app.use("/api/company", require("./src/features/company-analytics/analytics.routes"));


app.use("/api/workspaces", require("./src/features/workspaces/workspaces.routes"));

// ── WORKSPACE OS CORE ────────────────────────────────────────────────────────
// Clone / Export / Import / Analytics (additive — does not touch existing workspace routes)
app.use("/api/workspace-os", require("./src/features/workspace-os/workspace-os.routes"));
// Role × Module Permission Matrix + Feature Toggles + Audit Log reader
app.use("/api/permissions", require("./src/features/permissions/permissions.routes"));
// Immutable Compliance Log reader (admin-only)
app.use("/api/compliance-logs", require("./src/features/compliance/compliance.routes"));
// ─────────────────────────────────────────────────────────────────────────────
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
// Phase 4 — Smart Reply + Auto Translate
app.use("/api/ai", requireAuth, require("./src/features/ai/smartReply.routes"));

// ── AI INTELLIGENCE LAYER ─────────────────────────────────────────────────────
// ai-assistant: channel summary, action items, smart replies
app.use("/api/ai", requireAuth, require("./src/features/ai/assistant/ai-assistant.routes"));
// ai-knowledge: semantic search, Q&A, meeting query
app.use("/api/ai", requireAuth, require("./src/features/ai/knowledge/ai-knowledge.routes"));
// ai-automation: NL commands, task generation
app.use("/api/ai", requireAuth, require("./src/features/ai/automation/ai-automation.routes"));
// ai-insights: productivity, collaboration, engagement, anomaly detection
app.use("/api/ai", requireAuth, require("./src/features/ai/insights/ai-insights.routes"));
// ─────────────────────────────────────────────────────────────────────────────
// Unified Activity Stream — workspace feed + personal history
app.use("/api/activity", require("./src/features/activity/activity.routes"));
// AREA 1 — API VERSION MIGRATION COMPLETE (Phase 3):
// Legacy /api/notes and /api/tasks mounts have been removed.
// All frontend callers have been confirmed on canonical /api/v2 paths:
//   NotesContext.jsx, uploadHelpers.js          → /api/v2/notes
//   TasksContext.jsx, KanbanBoard.jsx,
//   WorkspaceTaskDetailPanel.jsx, WorkloadPanel.jsx,
//   MyTasks.jsx                                 → /api/v2/tasks
// Canonical routes are at lines below: /api/v2/tasks and /api/v2/notes.

// ── ADVANCED TASK MANAGEMENT EXTENSIONS ──────────────────────────────────────
app.use("/api/sprints", require("./src/features/sprints/sprints.routes"));
app.use("/api/milestones", require("./src/features/milestones/milestones.routes"));
app.use("/api/task-templates", require("./src/features/task-templates/task-templates.routes"));
// ─────────────────────────────────────────────────────────────────────────────



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
// Phase 3 — Thread Resolve + AI Summary
app.use("/api/threads/v2", requireAuth, require("./src/modules/threads/threadsV2.routes"));

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

// Tasks — canonical v2 endpoint (sole active mount)
app.use("/api/v2/tasks", require("./src/features/tasks/tasks.routes"));

// Notes — canonical v2 endpoint (sole active mount)
app.use("/api/v2/notes", require("./src/features/notes/notes.routes"));

// Favorites (Migrated from legacy)
app.use("/api/v2/favorites", require("./src/features/favorites/favorites.routes"));

// Phase 1 — Message Bookmarks & Reminders
// ⚠️  IMPORTANT: app.use("/api", requireAuth, ...) below intercepts ALL /api/* requests.
// Any routes that do NOT use JWT auth must be registered BEFORE this line.
// ── DEVELOPER PUBLIC API (No JWT — Uses X-Api-Key) — MUST be before /api requireAuth ──
app.use('/api/public', require('./src/features/developer/publicApi.routes'));
// ─────────────────────────────────────────────────────────────────────────────
app.use("/api/messages", requireAuth, require("./src/features/messages/bookmark.routes"));
app.use("/api", requireAuth, require("./src/features/reminders/reminders.routes"));

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

// ── FILE MANAGEMENT + KNOWLEDGE SYSTEM ───────────────────────────────────────
app.use("/api/v2/files", require("./src/features/files/files.routes"));
app.use("/api/v2/knowledge", require("./src/features/knowledge/knowledge.routes"));
// ─────────────────────────────────────────────────────────────────────────────

// ── MEETINGS + COLLABORATION SYSTEM ──────────────────────────────────────────
app.use("/api/v2/meetings", require("./src/features/meetings/meetings.routes"));
app.use("/api/v2/collaboration", require("./src/features/collaboration/collaboration.routes"));
// ─────────────────────────────────────────────────────────────────────────────

// ── WORKFLOW AUTOMATION SYSTEM ────────────────────────────────────────────────
// GET/POST/PATCH/DELETE /api/v2/automations
// GET /api/v2/automations/templates
app.use("/api/v2/automations", requireAuth, require("./src/features/automations/automation.routes"));
// ─────────────────────────────────────────────────────────────────────────────

// ── INTEGRATION ECOSYSTEM ────────────────────────────────────────────────────
// /api/v2/integrations        → connect/disconnect/list integrations
// /api/v2/integrations/webhooks → webhook registration CRUD
// /api/v2/integrations/ai-providers → AI provider switching
// /api/v2/integrations/webhook/:type → inbound webhooks from external services
app.use("/api/v2/integrations", require("./src/features/integrations/integrations.routes"));
// ─────────────────────────────────────────────────────────────────────────────

// ── SECURITY & COMPLIANCE LAYER ──────────────────────────────────────────────
// SSO: GET /api/auth/sso/:provider + GET /api/auth/sso/:provider/callback
app.use("/api/auth/sso", require("./src/features/security/sso.routes"));
// 2FA: POST /api/auth/2fa/setup|verify-setup|disable|verify, GET /api/auth/2fa/status
app.use("/api/auth/2fa", require("./src/features/security/twoFactor.routes"));
// GDPR/Compliance: export, delete, legal hold, audit logs, retention policy
app.use("/api/compliance", require("./src/features/security/gdpr.routes"));
// Encrypted Backup + dev retention trigger
app.use("/api/security", require("./src/features/security/backup.routes"));
// ─────────────────────────────────────────────────────────────────────────────

// ── MULTI-PLATFORM — Push Notification Device Token Management ───────────────
// POST /api/push/register   — register mobile device token
// POST /api/push/unregister — remove mobile device token
app.use("/api/push", require("./routes/push.routes"));
// ─────────────────────────────────────────────────────────────────────────────

// ── DEVELOPER PLATFORM — Authenticated routes (JWT required) ─────────────────
// Note: /api/public is mounted EARLIER (before the /api requireAuth catch-all)
// API Key management (user JWT required)
app.use('/api/developer', require('./src/features/developer/apiKeys.routes'));
// Bot management
app.use('/api/developer', require('./src/features/developer/bots.routes'));
// App marketplace
app.use('/api/developer', require('./src/features/developer/apps.routes'));

// Seed marketplace apps on startup (idempotent)
require('./src/features/developer/seedApps').seedApps();
// ─────────────────────────────────────────────────────────────────────────────

// ── COMMUNITY & ECOSYSTEM MARKETPLACE ────────────────────────────────────────
// /api/marketplace/apps          → public app listing with ratings
// /api/marketplace/install       → install app into workspace (auth)
// /api/marketplace/review        → submit/update review (auth)
// /api/marketplace/reviews/:id   → read reviews (no auth)
// /api/marketplace/integrations/public → public integrations list
app.use('/api/marketplace', require('./src/features/community/marketplace.routes'));
// ─────────────────────────────────────────────────────────────────────────────

// ============================================================================
// 📦 V1 ROUTES (LEGACY - TO BE MIGRATED)
// ============================================================================
// - These routes should be gradually migrated to /api/v2
// - New code should use /api/v2/* endpoints
// - Migration complete: all traffic now served by /api/v2/messages
// - Gradual migration in progress
// =============================================================

// ---------------------------------------------------------
// SOCKET.IO AUTH + CONNECTION (Phase 4: extracted to feature modules)
// ---------------------------------------------------------
registerSocketAuth(io);       // JWT verification middleware → src/socket/socketAuth.js
registerSocketConnection(io); // Connection handler → src/socket/socketConnection.js

// ---------------------------------------------------------
// SCHEDULED MEETINGS ROUTES (Phase 4: moved to feature module)
// ---------------------------------------------------------
app.use('/api/scheduled-meetings', requireAuth, require('./src/features/meetings/scheduled-meetings.routes'));

// ---------------------------------------------------------
// ERROR HANDLERS (MUST BE AFTER ALL ROUTES)
// Phase 4: extracted to middleware/errorHandlers.js
// ---------------------------------------------------------
app.use(notFoundHandler);    // 404 — no path reflection in production (S-15)
app.use(globalErrorHandler); // Global error handler with structured logging

// ---------------------------------------------------------
// START SERVER (ONLY AFTER MONGO CONNECTS)
// ---------------------------------------------------------
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    logger.success("MongoDB Connected ✔");

    // Phase 1 — Start reminders cron (after DB is connected)
    const { startRemindersCron } = require('./src/features/reminders/reminders.cron');
    startRemindersCron(io);

    // ADV — Start recurring tasks cron (after DB is connected)
    const { startRecurringTasksCron } = require('./src/features/tasks/tasks.cron');
    startRecurringTasksCron();

    // Notifications cron — daily digest + task due-soon reminders
    const { startNotificationsCron } = require('./src/features/notifications/notifications.cron');
    startNotificationsCron(io);

    // Security — Message Retention cron (auto-delete expired messages per policy)
    const { startRetentionCron } = require('./src/features/security/retention.cron');
    startRetentionCron();

    // Automation — Scheduled automation runner (checks every 60s)
    const { startAutomationCron } = require('./src/features/automations/automation.cron');
    startAutomationCron(io);



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
