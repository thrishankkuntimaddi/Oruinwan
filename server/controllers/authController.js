// server/controllers/authController.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail'); // small helper below
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const ACCESS_EXPIRES = process.env.ACCESS_EXPIRES || '15m';
const REFRESH_TOKEN_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS || '30', 10);

function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), roles: user.roles },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

async function signup(req, res) {
  try {
    const { username, email, password, phone } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'Missing fields' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 12);

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = sha256(verificationToken);
    const verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    const user = new User({
      username, email, phone, passwordHash,
      verificationTokenHash, verificationTokenExpires
    });
    await user.save();

    // send verification email
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
    await sendEmail({
      to: email,
      subject: 'Verify your email',
      text: `Click to verify: ${verifyUrl}`,
      html: `<p>Click the link to verify your email:</p><a href="${verifyUrl}">${verifyUrl}</a>`
    });

    return res.status(201).json({ message: 'Signup successful, check email for verification' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function verifyEmail(req, res) {
  try {
    const { token, email } = req.query;
    if (!token || !email) return res.status(400).json({ message: 'Invalid request' });

    const tokenHash = sha256(token);
    const user = await User.findOne({ email, verificationTokenHash: tokenHash, verificationTokenExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.verified = true;
    user.verificationTokenHash = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    return res.json({ message: 'Email verified' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Missing credentials' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    // check lockout
    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      return res.status(423).json({ message: 'Account locked. Try later or check email.' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = Date.now() + 30 * 60 * 1000; // 30 minutes lock
        // optional: send alert email
        await sendEmail({
          to: user.email,
          subject: 'Account locked',
          text: 'We detected multiple failed login attempts. Your account has been temporarily locked.'
        });
      }
      await user.save();
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // reset failed attempts
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;

    // issue tokens
    const accessToken = signAccessToken(user);
    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = sha256(rawRefreshToken);
    const expiresAt = Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;

    // store refresh token hash
    user.refreshTokens.push({
      tokenHash,
      createdAt: Date.now(),
      expiresAt,
      deviceInfo: req.get('User-Agent') || 'unknown'
    });

    await user.save();

    // set httpOnly cookie for refresh token
    res.cookie('refreshToken', rawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/api/auth/refresh',
      maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
    });

    return res.json({
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        verified: user.verified,
        profile: user.profile
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function refresh(req, res) {
  try {
    const rawToken = req.cookies.refreshToken;
    if (!rawToken) return res.status(401).json({ message: 'No refresh token' });
    const tokenHash = sha256(rawToken);
    const user = await User.findOne({ 'refreshTokens.tokenHash': tokenHash });
    if (!user) {
      // possible token theft - clear cookie
      res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // find the token record
    const rec = user.refreshTokens.find(r => r.tokenHash === tokenHash);
    if (!rec || rec.expiresAt < Date.now()) {
      // remove token if expired
      user.refreshTokens = user.refreshTokens.filter(r => r.tokenHash !== tokenHash);
      await user.save();
      res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
      return res.status(401).json({ message: 'Refresh token expired' });
    }

    // Optionally: rotate refresh token (issue new one, remove old)
    const rawNewRefresh = crypto.randomBytes(64).toString('hex');
    const newHash = sha256(rawNewRefresh);
    const newExpiresAt = Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;

    // remove old token record & push new
    user.refreshTokens = user.refreshTokens.filter(r => r.tokenHash !== tokenHash);
    user.refreshTokens.push({ tokenHash: newHash, createdAt: Date.now(), expiresAt: newExpiresAt, deviceInfo: req.get('User-Agent') || 'unknown' });
    await user.save();

    // set new cookie
    res.cookie('refreshToken', rawNewRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/api/auth/refresh',
      maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
    });

    const accessToken = signAccessToken(user);
    return res.json({ accessToken, user: { id: user._id, username: user.username, email: user.email, profile: user.profile } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function logout(req, res) {
  try {
    const rawToken = req.cookies.refreshToken;
    if (rawToken) {
      const tokenHash = sha256(rawToken);
      // remove matching refresh token
      await User.updateOne({}, { $pull: { refreshTokens: { tokenHash } } });
      res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    }
    return res.json({ message: 'Logged out' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(200).json({ message: 'If that email exists, a reset link has been sent' }); // do not reveal

    const rawReset = crypto.randomBytes(32).toString('hex');
    const resetHash = sha256(rawReset);
    user.resetPasswordTokenHash = resetHash;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawReset}&email=${encodeURIComponent(email)}`;
    await sendEmail({
      to: email,
      subject: 'Password reset',
      text: `Reset: ${resetUrl}`,
      html: `<p>Reset your password:</p><a href="${resetUrl}">${resetUrl}</a>`
    });

    return res.json({ message: 'If that email exists, a reset link has been sent' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, email, password } = req.body;
    if (!token || !email || !password) return res.status(400).json({ message: 'Invalid request' });

    const tokenHash = sha256(token);
    const user = await User.findOne({ email, resetPasswordTokenHash: tokenHash, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;

    // Invalidate refresh tokens (force re-login)
    user.refreshTokens = [];
    await user.save();

    return res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  signup,
  verifyEmail,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword
};
