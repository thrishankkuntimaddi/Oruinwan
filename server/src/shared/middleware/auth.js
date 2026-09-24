const logger = require('../../../utils/logger');
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../../../models/User");

module.exports = async function requireAuth(req, res, next) {
  try {
    let accessToken;

    
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      accessToken = authHeader.split(" ")[1];
    }

    
    const refreshToken = req.cookies?.jwt;

    
    if (accessToken) {
      try {
        const payload = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
        req.user = payload;

        
        const deviceId = req.headers['x-device-id'];
        if (deviceId) {
          const deviceSessionService = require('../../services/deviceSession.service');
          const isRevoked = await deviceSessionService.isSessionRevoked(payload.sub, deviceId);

          if (isRevoked) {
            
            try {
              const securityAudit = require('../../services/securityAudit.service');
              securityAudit.logSecurityEvent({
                userId: payload.sub,
                eventType: 'DEVICE_REVOKED_ACCESS_BLOCKED',
                req,
                metadata: { deviceId }
              });
            } catch (_auditError) {
              
            }

            return res.status(403).json({
              message: 'Device has been revoked',
              code: 'DEVICE_REVOKED'
            });
          }

          
          deviceSessionService.updateSessionActivity(payload.sub, deviceId);

          
          req.deviceId = deviceId;
        }

        return next();
      } catch (err) {
        
        
        
        if (err.name !== 'TokenExpiredError') {
          return res.status(401).json({ message: 'Invalid access token', code: 'TOKEN_INVALID' });
        }
        // Expired access token with nothing to refresh from (native clients
        // refresh explicitly): tell the client exactly why, not "No token".
        if (!refreshToken) {
          return res.status(401).json({ message: 'Access token expired', code: 'TOKEN_EXPIRED' });
        }
      }
    }

    
    if (refreshToken) {
      try {
        const _decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

        
        const refreshHash = crypto
          .createHash("sha256")
          .update(refreshToken)
          .digest("hex");

        const user = await User.findOne({
          "refreshTokens.tokenHash": refreshHash,
        });

        if (!user) {
          return res.status(401).json({ message: "Invalid refresh token", code: 'REFRESH_INVALID' });
        }

        
        const tokenEntry = user.refreshTokens.find(t => t.tokenHash === refreshHash);
        if (!tokenEntry || tokenEntry.expiresAt < new Date()) {
          return res.status(401).json({ message: "Refresh token expired", code: 'REFRESH_EXPIRED' });
        }

        
        const newAccess = jwt.sign(
          { sub: user._id, roles: user.roles },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "15m" }
        );

        
        req.user = jwt.verify(newAccess, process.env.ACCESS_TOKEN_SECRET);

        
        res.setHeader("x-access-token", newAccess);

        return next();

      } catch (err) {
        
        
        if (err.name === 'TokenExpiredError') {
          
          return res.status(401).json({ message: 'Refresh token expired', code: 'REFRESH_EXPIRED' });
        }
        if (err.name === 'JsonWebTokenError') {
          
          
          return res.status(403).json({ message: 'Invalid token signature' });
        }
        
        
        logger.error('AUTH MIDDLEWARE CATCH (refresh path):', err);
        return res.status(500).json({ message: 'Server error during authentication' });
      }
    }

    return res.status(401).json({ message: "No token", code: 'NO_TOKEN' });

  } catch (err) {
    logger.error("AUTH MIDDLEWARE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
