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

// Serve uploaded files as static files
app.use(express.static(path.join(__dirname, "../client/build")));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./middleware/auth"), require("./routes/admin"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/chat", require("./routes/chatList"));
app.use("/api/channels", require("./routes/channels"));
app.use("/api/companies", require("./routes/companies"));
app.use("/api/departments", require("./routes/departments"));
app.use("/api/workspaces", require("./routes/workspaces"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/notes", require("./routes/notes"));
app.use("/api/updates", require("./routes/updates"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/favorites", require("./routes/favorites"));
app.use("/api/users", require("./routes/user"));
app.use("/api/search", require("./routes/search"));
app.use("/api/support", require("./routes/support"));
app.use("/api/audit", require("./routes/audit"));
app.use("/api/managers", require("./routes/managers"));
app.use("/api/analytics", require("./routes/analytics"));

// ---------------------------------------------------------
// SOCKET.IO SETUP
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

// SOCKET AUTH (using Access Token)
const jwt = require("jsonwebtoken");

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    socket.user = { id: decoded.sub };
    next();
  } catch (err) {
    if (err.name !== 'TokenExpiredError') {
      logger.error("Socket auth error:", err.message);
    }
    next(new Error("Authentication failed"));
  }
});

io.on("connection", (socket) => {
  logger.debug("Socket connected:", socket.user.id);
  registerChatHandlers(io, socket);
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

