const logger = require('../../utils/logger');
const jwt = require('jsonwebtoken');

function registerSocketAuth(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        logger.info('❌ Socket auth: No token provided');
        return next(new Error('No token'));
      }

      logger.info('🔐 Socket auth: Verifying token...');
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      logger.info('✅ Socket auth: Token valid for user:', decoded.sub);
      socket.user = { id: decoded.sub };
      next();
    } catch (err) {
      logger.error('❌ Socket auth error:', err.name, '-', err.message);
      if (err.name === 'TokenExpiredError') {
        logger.info('⏰ Token expired at:', err.expiredAt);
        const expired = new Error('Token expired');
        expired.data = { code: 'TOKEN_EXPIRED' };
        return next(expired);
      }
      const failed = new Error('Authentication failed');
      failed.data = { code: 'TOKEN_INVALID' };
      next(failed);
    }
  });
}

module.exports = registerSocketAuth;
