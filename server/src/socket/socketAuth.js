// server/src/socket/socketAuth.js
// Socket.IO JWT authentication middleware
// Extracted from server.js (Phase 4 cleanup)

const jwt = require('jsonwebtoken');

/**
 * Registers the Socket.IO authentication middleware on the given io instance.
 * Verifies the JWT access token attached to the socket handshake.
 *
 * @param {import('socket.io').Server} io
 */
function registerSocketAuth(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        console.log('❌ Socket auth: No token provided');
        return next(new Error('No token'));
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
      next(new Error('Authentication failed'));
    }
  });
}

module.exports = registerSocketAuth;
