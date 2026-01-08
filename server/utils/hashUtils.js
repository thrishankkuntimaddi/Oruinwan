// server/utils/hashUtils.js

const crypto = require("crypto");

/**
 * Generate SHA-256 hash of a value
 * @param {String} value - Value to hash
 * @returns {String} Hexadecimal hash string
 */
exports.sha256 = (value) => {
    return crypto.createHash("sha256").update(value).digest("hex");
};

/**
 * Generate random token
 * @param {Number} bytes - Number of bytes for the token (default: 32)
 * @returns {String} Random hex string
 */
exports.generateToken = (bytes = 32) => {
    return crypto.randomBytes(bytes).toString("hex");
};

/**
 * Generate token and its hash (for verification tokens, invite tokens, etc.)
 * @param {Number} bytes - Number of bytes for the token (default: 32)
 * @returns {Object} { token: rawToken, hash: hashedToken }
 */
exports.generateTokenWithHash = (bytes = 32) => {
    const token = exports.generateToken(bytes);
    const hash = exports.sha256(token);
    return { token, hash };
};
