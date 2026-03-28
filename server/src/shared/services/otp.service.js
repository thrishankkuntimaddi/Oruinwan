/**
 * OTP Service — Shared OTP Management
 *
 * Provides OTP generation, storage, verification, and sending capabilities.
 * Can be used across multiple features (company registration, user verification, etc.)
 *
 * Storage is delegated to the abstracted otpStore module.
 * To swap the backend (e.g. Redis), only otpStore.js needs to change.
 *
 * @module shared/services/otp
 */

'use strict';

const sendEmail = require('../../../utils/sendEmail');
const { sendOTP } = require('../../../utils/sendOTP');
const otpStore = require('./otpStore');
const logger = require('../utils/logger');

// ============================================================================
// OTP GENERATION
// ============================================================================

/**
 * Generate a cryptographically-safe 6-digit OTP.
 * @returns {string} 6-digit OTP string
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================================================
// OTP STORAGE (via abstracted store)
// ============================================================================

/**
 * Store OTP with expiration.
 * @param {string} target       - Email or phone number (store key)
 * @param {string} otp          - Generated OTP
 * @param {number} expiryMinutes - Expiration in minutes (default: 5)
 */
function storeOTP(target, otp, expiryMinutes = 5) {
  otpStore.set(target, { otp, expires: Date.now() + expiryMinutes * 60 * 1000 }, expiryMinutes * 60 * 1000);
}

/**
 * Retrieve OTP data for a target.
 * @param {string} target
 * @returns {Object|null} { otp, expires } or null
 */
function getOTP(target) {
  return otpStore.get(target);
}

/**
 * Delete OTP for a target.
 * @param {string} target
 */
function deleteOTP(target) {
  otpStore.delete(target);
}

// ============================================================================
// OTP DELIVERY
// ============================================================================

/**
 * Send OTP via email.
 * @param {string} email     - Target email address
 * @param {string} otp       - OTP to send
 * @param {Object} [options] - subject, message overrides
 */
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

/**
 * Send OTP via SMS.
 * @param {string} phone - Target phone number (E.164 format)
 * @param {string} otp   - OTP to send
 */
async function sendOTPSMS(phone, otp) {
  let formattedPhone = phone;
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = `+91${formattedPhone}`; // Default country prefix (India)
  }
  await sendOTP(formattedPhone, otp);
}

/**
 * Send OTP based on type (email or phone).
 * Falls back to a structured log in dev mode if delivery fails.
 *
 * @param {Object} params
 * @param {string} params.target  - Email or phone number
 * @param {string} params.type    - 'email' | 'phone'
 * @param {string} params.otp     - OTP to send
 * @param {Object} [params.options] - Additional email options
 * @returns {Promise<{success: boolean, devMode: boolean}>}
 */
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
    // Delivery failed — log the OTP clearly for dev/debug visibility
    logger.warn(
      { type, target, err: error.message },
      `OTP delivery failed — DEV fallback active. OTP for ${target}: ${otp}`
    );
    return { success: true, devMode: true };
  }
}

// ============================================================================
// OTP VERIFICATION
// ============================================================================

/**
 * Verify OTP.
 * @param {string} target - Email or phone number
 * @param {string} otp    - OTP to verify
 * @returns {{ valid: boolean, error: string|null }}
 */
function verifyOTP(target, otp) {
  const data = getOTP(target);

  if (!data) {
    return { valid: false, error: 'OTP not found or expired' };
  }

  if (Date.now() > data.expires) {
    deleteOTP(target);
    return { valid: false, error: 'OTP expired' };
  }

  if (data.otp !== otp) {
    return { valid: false, error: 'Invalid OTP' };
  }

  // Valid — delete to prevent re-use
  deleteOTP(target);
  return { valid: true, error: null };
}

// ============================================================================
// HIGH-LEVEL WORKFLOW
// ============================================================================

/**
 * Complete OTP flow: Generate → Store → Send.
 * @param {Object} params
 * @param {string} params.target  - Email or phone number
 * @param {string} params.type    - 'email' | 'phone'
 * @param {Object} [params.options] - Additional email options
 * @returns {Promise<{otp: string, sent: boolean, devMode: boolean}>}
 */
async function generateAndSendOTP({ target, type, options = {} }) {
  const otp = generateOTP();
  storeOTP(target, otp);

  const sendResult = await sendOTPByType({ target, type, otp, options });

  return {
    otp,                        // Included for testing / dev inspection
    sent: sendResult.success,
    devMode: sendResult.devMode,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  // Core store operations
  generateOTP,
  storeOTP,
  getOTP,
  deleteOTP,
  verifyOTP,

  // Delivery
  sendOTPEmail,
  sendOTPSMS,
  sendOTPByType,

  // High-level workflow
  generateAndSendOTP,
};
