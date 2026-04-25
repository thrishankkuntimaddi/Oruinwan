const crypto = require("crypto");

exports.sha256 = (value) => {
    return crypto.createHash("sha256").update(value).digest("hex");
};

exports.generateToken = (bytes = 32) => {
    return crypto.randomBytes(bytes).toString("hex");
};

exports.generateTokenWithHash = (bytes = 32) => {
    const token = exports.generateToken(bytes);
    const hash = exports.sha256(token);
    return { token, hash };
};
