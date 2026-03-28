// server/src/shared/middleware/auth.js
// CANONICAL auth middleware — Phase 5: merged from legacy server/middleware/auth.js
// Contains: device session revocation (Phase 3) + error differentiation (legacy security fix)
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../../../models/User");

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

        // ⚠️ PHASE 3: Check device session revocation
        const deviceId = req.headers['x-device-id'];
        if (deviceId) {
          const deviceSessionService = require('../../services/deviceSession.service');
          const isRevoked = await deviceSessionService.isSessionRevoked(payload.sub, deviceId);

          if (isRevoked) {
            // PHASE 4A: Log blocked access attempt (best-effort, non-blocking)
            try {
              const securityAudit = require('../../services/securityAudit.service');
              securityAudit.logSecurityEvent({
                userId: payload.sub,
                eventType: 'DEVICE_REVOKED_ACCESS_BLOCKED',
                req,
                metadata: { deviceId }
              });
            } catch (_auditError) {
              // Silent fail (non-critical)
            }

            return res.status(403).json({
              message: 'Device has been revoked',
              code: 'DEVICE_REVOKED'
            });
          }

          // Update last active (non-blocking)
          deviceSessionService.updateSessionActivity(payload.sub, deviceId);

          // Attach deviceId to request
          req.deviceId = deviceId;
        }

        return next();
      } catch (err) {
        // Only fall through to refresh cookie on token expiry.
        // All other JWT errors (invalid signature, tampered) → reject immediately.
        // (S-LEGACY: prevents retry loops when token is invalid rather than expired)
        if (err.name !== 'TokenExpiredError') {
          return res.status(401).json({ message: 'Invalid access token' });
        }
        // TokenExpiredError: fall through to refresh cookie path
      }
    }

    // CASE 2: NO access token but refresh cookie exists → auto refresh
    if (refreshToken) {
      try {
        const _decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

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

        // Check if this specific token has expired
        const tokenEntry = user.refreshTokens.find(t => t.tokenHash === refreshHash);
        if (!tokenEntry || tokenEntry.expiresAt < new Date()) {
          return res.status(401).json({ message: "Refresh token expired" });
        }

        // Generate NEW access token (auto refresh)
        const newAccess = jwt.sign(
          { sub: user._id, roles: user.roles },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "15m" }
        );

        // Attach new access token to req.user
        req.user = jwt.verify(newAccess, process.env.ACCESS_TOKEN_SECRET);

        // Send new access token to frontend
        res.setHeader("x-access-token", newAccess);

        return next();

      } catch (err) {
        // Differentiate error types so the client interceptor doesn't retry
        // on non-expiry errors (which would create retry loops or mass logouts).
        if (err.name === 'TokenExpiredError') {
          // Refresh token itself expired → legitimate re-login
          return res.status(401).json({ message: 'Refresh token expired' });
        }
        if (err.name === 'JsonWebTokenError') {
          // Tampered token or wrong REFRESH_TOKEN_SECRET (e.g. after redeploy).
          // Return 403 so Axios interceptor does NOT retry → no retry loop.
          return res.status(403).json({ message: 'Invalid token signature' });
        }
        // DB error, Mongoose error, or unknown — log and return 500.
        // 500 is not caught by the Axios 401-interceptor → no retry loop.
        console.error('AUTH MIDDLEWARE CATCH (refresh path):', err);
        return res.status(500).json({ message: 'Server error during authentication' });
      }
    }

    return res.status(401).json({ message: "No token" });

  } catch (err) {
    console.error("AUTH MIDDLEWARE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
