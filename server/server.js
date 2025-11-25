// server/server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");
const registerChatHandlers = require("./socket");

// Initialize app
const app = express();

app.set("trust proxy", 1);

// --- Middlewares ---
app.use(express.json());
app.use(cookieParser());
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Rate limiting (protect auth endpoints)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Increased for development (reduce to 20 in production)
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
  .then(() => console.log("MongoDB Connected ✔"))
  .catch((err) => console.log("MongoDB Error ❌", err));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/chat", require("./routes/chatList"));
app.use("/api/channels", require("./routes/channels"));

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
    console.error("SOCKET AUTH ERROR:", err);
    next(new Error("Authentication failed"));
  }
});

// Register socket events
io.on("connection", (socket) => {
  console.log("User connected:", socket.user.id);

  registerChatHandlers(io, socket);
});

// ---------------------------------------------------------
// START SERVER
// ---------------------------------------------------------
const PORT = process.env.PORT;

httpServer.listen(PORT, () =>
  console.log(`Server (Socket.io + Express) running on port ${PORT}`)
);
