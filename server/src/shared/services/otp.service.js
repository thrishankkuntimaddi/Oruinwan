'use strict';

const sendEmail = require('../../../utils/sendEmail');
const { sendOTP } = require('../../../utils/sendOTP');
const otpStore = require('./otpStore');
const crypto = require('crypto');
const logger = require('../utils/logger');

const MAX_VERIFY_ATTEMPTS = 5;          // per issued code
const SEND_WINDOW_MS = 15 * 60 * 1000;  // per-target send throttle window
const MAX_SENDS_PER_WINDOW = 5;
const _sendLog = new Map();             // target -> [timestamps]

function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

function storeOTP(target, otp, expiryMinutes = 5) {
  otpStore.set(target, { otp, expires: Date.now() + expiryMinutes * 60 * 1000, attempts: 0 }, expiryMinutes * 60 * 1000);
}

// Per-target send throttle (complements the per-IP express-rate-limit on the routes).
function checkSendThrottle(target) {
  const now = Date.now();
  const recent = (_sendLog.get(target) || []).filter(t => now - t < SEND_WINDOW_MS);
  if (recent.length >= MAX_SENDS_PER_WINDOW) {
    _sendLog.set(target, recent);
    const err = new Error('Too many OTP requests. Please try again later.');
    err.status = 429;
    err.statusCode = 429;
    throw err;
  }
  recent.push(now);
  _sendLog.set(target, recent);
  if (_sendLog.size > 10000) {
    for (const [k, v] of _sendLog) {
      if (!v.some(t => now - t < SEND_WINDOW_MS)) _sendLog.delete(k);
    }
  }
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function getOTP(target) {
  return otpStore.get(target);
}

function deleteOTP(target) {
  otpStore.delete(target);
}

async function sendOTPEmail(email, otp, options = {}) {
  const subject = options.subject || 'Chttrix Verification Code';
  const message = options.message || 'Your verification code is:';

  await sendEmail({
    to: email,
    subject,
    html: `
      <p>${message} <strong>${otp}</strong></p>
      <p>This code will expire in 5 minutes.</p>
    `,
  });
}

async function sendOTPSMS(phone, otp) {
  let formattedPhone = phone;
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = `+91${formattedPhone}`; 
  }
  await sendOTP(formattedPhone, otp);
}

async function sendOTPByType({ target, type, otp, options = {} }) {
  try {
    if (type === 'phone') {
      await sendOTPSMS(target, otp);
      logger.info({ type, target }, 'Phone OTP sent');
      return { success: true, devMode: false };
    } else if (type === 'email') {
      await sendOTPEmail(target, otp, options);
      logger.info({ type, target }, 'Email OTP sent');
      return { success: true, devMode: false };
    } else {
      throw new Error(`Invalid OTP type: ${type}`);
    }
  } catch (error) {
    // Never log the code itself. Outside production we tolerate delivery failure
    // (local dev without SMTP/SMS); in production the send must fail.
    logger.warn({ type, err: error.message }, 'OTP delivery failed');
    if (process.env.NODE_ENV === 'production') {
      return { success: false, devMode: false };
    }
    return { success: true, devMode: true };
  }
}

function verifyOTP(target, otp) {
  const data = getOTP(target);

  if (!data) {
    return { valid: false, error: 'OTP not found or expired' };
  }

  if (Date.now() > data.expires) {
    deleteOTP(target);
    return { valid: false, error: 'OTP expired' };
  }

  if ((data.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
    deleteOTP(target);
    return { valid: false, error: 'Too many attempts. Please request a new code.' };
  }

  if (!safeEqual(data.otp, otp)) {
    data.attempts = (data.attempts || 0) + 1;
    if (data.attempts >= MAX_VERIFY_ATTEMPTS) {
      deleteOTP(target);
      return { valid: false, error: 'Too many attempts. Please request a new code.' };
    }
    return { valid: false, error: 'Invalid OTP' };
  }

  
  deleteOTP(target);
  return { valid: true, error: null };
}

async function generateAndSendOTP({ target, type, options = {} }) {
  checkSendThrottle(target);
  const otp = generateOTP();
  storeOTP(target, otp);

  const sendResult = await sendOTPByType({ target, type, otp, options });
  if (!sendResult.success) {
    deleteOTP(target);
    const err = new Error('Failed to deliver verification code');
    err.status = 502;
    err.statusCode = 502;
    throw err;
  }

  return {
    otp,                        
    sent: sendResult.success,
    devMode: sendResult.devMode,
  };
}

module.exports = {
  
  generateOTP,
  storeOTP,
  getOTP,
  deleteOTP,
  verifyOTP,
  checkSendThrottle,
  MAX_VERIFY_ATTEMPTS,

  
  sendOTPEmail,
  sendOTPSMS,
  sendOTPByType,

  
  generateAndSendOTP,
};
