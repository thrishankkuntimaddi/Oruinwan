// server/middleware/auth.js
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");

module.exports = async function requireAuth(req, res, next) {
  try {
    let accessToken;

    // 1. Try reading access token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      accessToken = authHeader.split(" ")[1];
    }

    // 2. If no access token → try refresh token from cookie ("jwt")
    const refreshToken = req.cookies?.jwt;

    // CASE 1: ACCESS TOKEN exists → verify normally
    if (accessToken) {
      try {
        const payload = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
        req.user = payload;
        return next();
      } catch (err) {
        // access token expired → fall through to cookie
      }
    }

    // CASE 2: NO access token but refresh cookie exists → auto refresh
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

        // Hash refresh token to find user
        const refreshHash = crypto
          .createHash("sha256")
          .update(refreshToken)
          .digest("hex");

        const user = await User.findOne({
          "refreshTokens.tokenHash": refreshHash,
        });

        if (!user) {
          return res.status(401).json({ message: "Invalid refresh token" });
        }

        // Generate NEW access token (auto refresh)
        const newAccess = jwt.sign(
          { sub: user._id, roles: user.roles },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "15m" }
        );

        // Attach new access token to req.user
        req.user = jwt.verify(newAccess, process.env.ACCESS_TOKEN_SECRET);

        // Send new access token to frontend (optional)
        res.setHeader("x-access-token", newAccess);

        return next();

      } catch (err) {
        return res.status(401).json({ message: "Token expired, please login again" });
      }
    }

    return res.status(401).json({ message: "No token" });

  } catch (err) {
    console.error("AUTH MIDDLEWARE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
