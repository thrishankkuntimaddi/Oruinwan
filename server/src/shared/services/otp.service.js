'use strict';

const sendEmail = require('../../../utils/sendEmail');
const { sendOTP } = require('../../../utils/sendOTP');
const otpStore = require('./otpStore');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { recordDevSms, consoleOnly } = require('../../../utils/devMail');

const MAX_VERIFY_ATTEMPTS = 5;          // per issued code
const SEND_WINDOW_MS = 15 * 60 * 1000;  // per-target send throttle window
const MAX_SENDS_PER_WINDOW = 5;

function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

async function storeOTP(target, otp, expiryMinutes = 5) {
  await otpStore.set(target, { otp, expires: Date.now() + expiryMinutes * 60 * 1000 }, expiryMinutes * 60 * 1000);
}

// Per-target send throttle (complements the per-IP express-rate-limit on the routes).
// Counted in the shared store, so it holds across server instances.
async function checkSendThrottle(target) {
  const sends = await otpStore.incr(`send:${target}`, SEND_WINDOW_MS);
  if (sends > MAX_SENDS_PER_WINDOW) {
    const err = new Error('Too many OTP requests. Please try again later.');
    err.status = 429;
    err.statusCode = 429;
    throw err;
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

async function deleteOTP(target) {
  await otpStore.delete(target);
  await otpStore.delete(`${target}:tries`);
}

async function sendOTPEmail(email, otp, options = {}) {
  const subject = options.subject || 'Oruinwan Verification Code';
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
  // Development only: the code also goes to the dev outbox (console + file), and with
  // DEV_MAIL=console no real text is sent at all.
  if (recordDevSms(formattedPhone, `Your Oruinwan verification code is ${otp}`) && consoleOnly()) return;
  await sendOTP(formattedPhone, otp);
}

async function sendOTPByType({ target, type, otp, options = {} }) {
  try {
    if (type === 'phone') {
      await sendOTPSMS(target, otp);
      logger.info({ type }, 'Phone OTP sent');
      return { success: true, devMode: false };
    } else if (type === 'email') {
      await sendOTPEmail(target, otp, options);
      logger.info({ type }, 'Email OTP sent');
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
    // Development only: the code is already in the dev outbox (utils/devMail.js).
    return { success: true, devMode: true };
  }
}

async function verifyOTP(target, otp) {
  const data = await getOTP(target);

  if (!data) {
    return { valid: false, error: 'OTP not found or expired' };
  }

  if (Date.now() > data.expires) {
    await deleteOTP(target);
    return { valid: false, error: 'OTP expired' };
  }

  // Every guess counts, including parallel ones: the counter is incremented atomically.
  const tries = await otpStore.incr(`${target}:tries`, Math.max(1000, data.expires - Date.now()));
  if (tries > MAX_VERIFY_ATTEMPTS) {
    await deleteOTP(target);
    return { valid: false, error: 'Too many attempts. Please request a new code.' };
  }

  if (!safeEqual(data.otp, otp)) {
    if (tries >= MAX_VERIFY_ATTEMPTS) {
      await deleteOTP(target);
      return { valid: false, error: 'Too many attempts. Please request a new code.' };
    }
    return { valid: false, error: 'Invalid OTP' };
  }

  await deleteOTP(target);
  return { valid: true, error: null };
}

async function generateAndSendOTP({ target, type, options = {} }) {
  await checkSendThrottle(target);
  const otp = generateOTP();
  await storeOTP(target, otp);

  const sendResult = await sendOTPByType({ target, type, otp, options });
  if (!sendResult.success) {
    await deleteOTP(target);
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
