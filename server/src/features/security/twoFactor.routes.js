'use strict';
const logger = require('../../../utils/logger');

const express = require('express');
const router = express.Router();
const { users } = require('../../identity');
const AuditLog = require('../../../models/AuditLog');
const requireAuth = require('../../shared/middleware/auth');
const { otplib, encryptSecret, decryptSecret, verifyTotp } = require('./totp');

/**
 * PNG data URL of the otpauth:// QR code, rendered on the server so the secret never goes
 * to a third-party QR service. Returns null when no QR library is installed.
 */
async function qrDataUrlFor(otpauthUrl) {
  let QRCode;
  try { QRCode = require('qrcode'); } catch { return null; }
  try {
    return await QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: 'M', margin: 1, width: 240 });
  } catch (err) {
    logger.warn({ err: err.message }, '[2FA] QR render failed');
    return null;
  }
}

/**
 * POST /api/auth/2fa/setup -> { secret, otpauthUrl, qrDataUrl (PNG data URL or null), message }
 * Confirm with POST /verify-setup { otp }.
 */
router.post('/setup', requireAuth, async (req, res) => {
  try {
    const user = await users.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is already enabled. Disable it first.' });
    }

    const secret = otplib.generateSecret();
    const otpauthUrl = otplib.generateURI({ issuer: 'Oruinwan', label: user.email, secret });
    const qrDataUrl = await qrDataUrlFor(otpauthUrl);

    
    await users.update(req.user.sub, { twoFactorSecret: encryptSecret(secret) });

    return res.json({
      secret,
      otpauthUrl,
      qrDataUrl,
      message: 'Scan the QR code with your authenticator app, then call /2fa/verify-setup with the OTP to complete setup.'
    });
  } catch (err) {
    logger.error('[2FA] setup error:', err);
    return res.status(500).json({ message: 'Failed to setup 2FA' });
  }
});

router.post('/verify-setup', requireAuth, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ message: 'OTP is required' });

    const user = await users.findById(req.user.sub, { withSecrets: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.twoFactorEnabled) return res.status(400).json({ message: '2FA is already enabled' });
    if (!user.twoFactorSecret) return res.status(400).json({ message: 'Run /2fa/setup first' });

    const secret = decryptSecret(user.twoFactorSecret);
    const isValid = await verifyTotp(otp, secret);
    if (!isValid) return res.status(400).json({ message: 'Invalid OTP. Please try again.' });

    await users.update(req.user.sub, { twoFactorEnabled: true });

    
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
    logger.error('[2FA] verify-setup error:', err);
    return res.status(500).json({ message: 'Failed to verify OTP' });
  }
});

router.post('/disable', requireAuth, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ message: 'OTP is required to disable 2FA' });

    const user = await users.findById(req.user.sub, { withSecrets: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.twoFactorEnabled) return res.status(400).json({ message: '2FA is not enabled' });

    const secret = decryptSecret(user.twoFactorSecret);
    const isValid = await verifyTotp(otp, secret);
    if (!isValid) return res.status(400).json({ message: 'Invalid OTP' });

    await users.update(req.user.sub, { twoFactorEnabled: false, twoFactorSecret: null });

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
    logger.error('[2FA] disable error:', err);
    return res.status(500).json({ message: 'Failed to disable 2FA' });
  }
});

router.post('/verify', requireAuth, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ message: 'OTP is required' });

    const user = await users.findById(req.user.sub, { withSecrets: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.twoFactorEnabled) return res.status(400).json({ message: '2FA is not enabled' });

    const secret = decryptSecret(user.twoFactorSecret);
    const isValid = await verifyTotp(otp, secret);
    if (!isValid) return res.status(400).json({ message: 'Invalid OTP' });

    return res.json({ valid: true, message: 'OTP verified' });
  } catch (err) {
    logger.error('[2FA] verify error:', err);
    return res.status(500).json({ message: 'Failed to verify OTP' });
  }
});

router.get('/status', requireAuth, async (req, res) => {
  try {
    const user = await users.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ twoFactorEnabled: user.twoFactorEnabled || false });
  } catch (err) {
    logger.error('[2FA] status error:', err);
    return res.status(500).json({ message: 'Failed to fetch 2FA status' });
  }
});

module.exports = router;
