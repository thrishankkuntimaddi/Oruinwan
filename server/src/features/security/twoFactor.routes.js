'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticator } = require('otplib');
const User = require('../../../models/User');
const AuditLog = require('../../../models/AuditLog');
const requireAuth = require('../../shared/middleware/auth');

const ENCRYPT_KEY = Buffer.from(process.env.SERVER_KEK || process.env.ACCESS_TOKEN_SECRET.slice(0, 64), 'hex');

function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPT_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptSecret(ciphertext) {
  const [ivHex, tagHex, encHex] = ciphertext.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPT_KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
}

router.post('/setup', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.sub).select('username email twoFactorEnabled');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is already enabled. Disable it first.' });
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'Chttrix', secret);

    
    await User.findByIdAndUpdate(req.user.sub, {
      twoFactorSecret: encryptSecret(secret),
    });

    return res.json({
      secret,           
      otpauthUrl,       
      message: 'Scan the QR code with your authenticator app, then call /2fa/verify-setup with the OTP to complete setup.'
    });
  } catch (err) {
    console.error('[2FA] setup error:', err);
    return res.status(500).json({ message: 'Failed to setup 2FA' });
  }
});

router.post('/verify-setup', requireAuth, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ message: 'OTP is required' });

    const user = await User.findById(req.user.sub).select('twoFactorSecret twoFactorEnabled email');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.twoFactorEnabled) return res.status(400).json({ message: '2FA is already enabled' });
    if (!user.twoFactorSecret) return res.status(400).json({ message: 'Run /2fa/setup first' });

    const secret = decryptSecret(user.twoFactorSecret);
    const isValid = authenticator.verify({ token: otp, secret });
    if (!isValid) return res.status(400).json({ message: 'Invalid OTP. Please try again.' });

    await User.findByIdAndUpdate(req.user.sub, { twoFactorEnabled: true });

    
    await AuditLog.create({
      userId: user._id,
      action: 'auth.2fa_enabled',
      resource: 'User',
      resourceId: user._id,
      description: '2FA enabled by user',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      category: 'security',
      severity: 'info',
    });

    return res.json({ message: '2FA enabled successfully', twoFactorEnabled: true });
  } catch (err) {
    console.error('[2FA] verify-setup error:', err);
    return res.status(500).json({ message: 'Failed to verify OTP' });
  }
});

router.post('/disable', requireAuth, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ message: 'OTP is required to disable 2FA' });

    const user = await User.findById(req.user.sub).select('twoFactorSecret twoFactorEnabled');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.twoFactorEnabled) return res.status(400).json({ message: '2FA is not enabled' });

    const secret = decryptSecret(user.twoFactorSecret);
    const isValid = authenticator.verify({ token: otp, secret });
    if (!isValid) return res.status(400).json({ message: 'Invalid OTP' });

    await User.findByIdAndUpdate(req.user.sub, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
    });

    await AuditLog.create({
      userId: user._id,
      action: 'auth.2fa_disabled',
      resource: 'User',
      resourceId: user._id,
      description: '2FA disabled by user',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      category: 'security',
      severity: 'warning',
    });

    return res.json({ message: '2FA disabled successfully', twoFactorEnabled: false });
  } catch (err) {
    console.error('[2FA] disable error:', err);
    return res.status(500).json({ message: 'Failed to disable 2FA' });
  }
});

router.post('/verify', requireAuth, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ message: 'OTP is required' });

    const user = await User.findById(req.user.sub).select('twoFactorSecret twoFactorEnabled');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.twoFactorEnabled) return res.status(400).json({ message: '2FA is not enabled' });

    const secret = decryptSecret(user.twoFactorSecret);
    const isValid = authenticator.verify({ token: otp, secret });
    if (!isValid) return res.status(400).json({ message: 'Invalid OTP' });

    return res.json({ valid: true, message: 'OTP verified' });
  } catch (err) {
    console.error('[2FA] verify error:', err);
    return res.status(500).json({ message: 'Failed to verify OTP' });
  }
});

router.get('/status', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.sub).select('twoFactorEnabled');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ twoFactorEnabled: user.twoFactorEnabled || false });
  } catch (err) {
    console.error('[2FA] status error:', err);
    return res.status(500).json({ message: 'Failed to fetch 2FA status' });
  }
});

module.exports = router;
