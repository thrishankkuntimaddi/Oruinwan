// ⚠️  DEPRECATED — DO NOT USE
// This file generates tokens with payload { id, email, roles }.
// The auth middleware (server/middleware/auth.js) reads { sub } — incompatible.
// Tokens from these functions will silently fail all protected route checks.
//
// Use the token generation logic inside:
//   server/src/features/auth/auth.controller.js  (generateAccessToken / generateRefreshToken)
//
// This file will be removed in a future cleanup pass.

const jwt = require("jsonwebtoken");

function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      roles: user.roles,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    {
      id: user._id
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN }
  );
}

module.exports = {
  generateAccessToken,
  generateRefreshToken
};
