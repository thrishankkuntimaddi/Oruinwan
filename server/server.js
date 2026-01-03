/**********************************************************
 * Chttrix Backend – Production Safe Server Entry
 **********************************************************/

// Load env FIRST (safe locally, ignored by Railway)
require("dotenv").config();

// --------------------------------------------------------
// Imports
// --------------------------------------------------------
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const registerChatHandlers = require("./socket");
const logger = require("./utils/logger");

// --------------------------------------------------------
// Debug boot logs (very important for Railway)
// --------------------------------------------------------
console.log("🚀 Server file loaded");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("MONGO_URI exists:", !!process.env.MONGO_URI);

// --------------------------------------------------------
// App Init
// --------------------------------------------------------
const app = express();
app.set("trust proxy", 1);

// --------------------------------------------------------
// Middleware
// --------------------------------------------------------
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
app.use(helmet());

// --------------------------------------------------------
// CORS Setup
// --------------------------------------------------------
const isProduction = process.env.NODE_ENV === "production";

const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

// Remove localhost in prod
if (isProduction) {
  for (let i = allowedOrigins.length - 1; i >= 0; i--) {
    if (allowedOrigins[i].includes("localhost")) {
      allowedOrigins.splice(i, 1);
    }
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// --------------------------------------------------------
// Rate Limiting (Auth Only)
// --------------------------------------------------------
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    ["/me", "/refresh", "/users"].includes(req.path),
  handler: (req, res) =>
    res.status(429).json({
      message: "Too many requests, try again later",
    }),
});

app.use("/api/auth", authLimiter);

// --------------------------------------------------------
// Routes
// --------------------------------------------------------
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

// --------------------------------------------------------
// Static files
// --------------------------------------------------------
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "../client/build")));

// --------------------------------------------------------
// HTTP + SOCKET.IO
// --------------------------------------------------------
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

// Socket authentication
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));

    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET
    );

    socket.user = { id: decoded.sub };
    next();
  } catch (err) {
    logger.error("Socket auth error:", err.message);
    next(new Error("Authentication failed"));
  }
});

// Socket handlers
io.on("connection", (socket) => {
  logger.debug("Socket connected:", socket.user.id);
  registerChatHandlers(io, socket);
});

// --------------------------------------------------------
// START SERVER (ONLY AFTER MONGO CONNECTS)
// --------------------------------------------------------
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    logger.success("MongoDB Connected ✔");

    httpServer.listen(PORT, () => {
      logger.success(
        `Server (Express + Socket.IO) running on port ${PORT}`
      );
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(
        `CORS allowed origins: ${allowedOrigins.join(", ")}`
      );
    });
  })
  .catch((err) => {
    logger.error("MongoDB Connection Failed ❌", err);
    process.exit(1);
  });
