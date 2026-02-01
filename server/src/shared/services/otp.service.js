/**
 * OTP Service - Shared OTP Management
 * 
 * Provides OTP generation, storage, verification, and sending capabilities.
 * Can be used across multiple features (company registration, user verification, etc.)
 * 
 * @module shared/services/otp
 */

const sendEmail = require('../../utils/sendEmail');
const { sendOTP } = require('../../utils/sendOTP');

// ============================================================================
// OTP STORE (In-Memory for Development)
// TODO: Migrate to Redis or database for production
// ============================================================================
const otpStore = new Map();

/**
 * Generate a 6-digit OTP
 * @returns {string} 6-digit OTP
 */
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Store OTP with expiration
 * @param {string} target - Email or phone number
 * @param {string} otp - Generated OTP
 * @param {number} expiryMinutes - Expiration time in minutes (default: 5)
 */
function storeOTP(target, otp, expiryMinutes = 5) {
    otpStore.set(target, {
        otp,
        expires: Date.now() + expiryMinutes * 60 * 1000
    });
}

/**
 * Retrieve OTP data for a target
 * @param {string} target - Email or phone number
 * @returns {Object|null} OTP data or null if not found
 */
function getOTP(target) {
    return otpStore.get(target) || null;
}

/**
 * Delete OTP for a target
 * @param {string} target - Email or phone number
 */
function deleteOTP(target) {
    otpStore.delete(target);
}

/**
 * Send OTP via email
 * @param {string} email - Target email address
 * @param {string} otp - OTP to send
 * @param {Object} options - Additional options (subject, template, etc.)
 * @returns {Promise<void>}
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
    `
    });
}

/**
 * Send OTP via SMS
 * @param {string} phone - Target phone number (E.164 format)
 * @param {string} otp - OTP to send
 * @returns {Promise<void>}
 */
async function sendOTPSMS(phone, otp) {
    // Ensure phone is in E.164 format
    let formattedPhone = phone;
    if (!formattedPhone.startsWith('+')) {
        formattedPhone = `+91${formattedPhone}`; // Default to India, should be configurable
    }

    await sendOTP(formattedPhone, otp);
}

/**
 * Send OTP based on type (email or phone)
 * Falls back to console logging if sending fails (dev mode)
 * 
 * @param {Object} params - Send parameters
 * @param {string} params.target - Email or phone number
 * @param {string} params.type - 'email' or 'phone'
 * @param {string} params.otp - OTP to send
 * @param {Object} params.options - Additional options for email
 * @returns {Promise<{success: boolean, devMode: boolean}>}
 */
async function sendOTPByType({ target, type, otp, options = {} }) {
    try {
        if (type === 'phone') {
            await sendOTPSMS(target, otp);
            console.log(`✅ Phone OTP sent to ${target}`);
            return { success: true, devMode: false };
        } else if (type === 'email') {
            await sendOTPEmail(target, otp, options);
            console.log(`✅ Email OTP sent to ${target}`);
            return { success: true, devMode: false };
        } else {
            throw new Error(`Invalid OTP type: ${type}`);
        }
    } catch (error) {
        // Fallback: Log to console for development
        console.log('\n' + '='.repeat(44));
        console.log(`🔐 [DEV OTP] Verification Code for ${type} (${target})`);
        console.log(`👉 CODE: ${otp}`);
        console.log('='.repeat(44) + '\n');

        return { success: true, devMode: true };
    }
}

/**
 * Verify OTP
 * @param {string} target - Email or phone number
 * @param {string} otp - OTP to verify
 * @returns {{valid: boolean, error: string|null}} Verification result
 */
function verifyOTP(target, otp) {
    const data = getOTP(target);

    if (!data) {
        return { valid: false, error: 'OTP not found or expired' };
    }

    // Check expiration
    if (Date.now() > data.expires) {
        deleteOTP(target);
        return { valid: false, error: 'OTP expired' };
    }

    // Check OTP match
    if (data.otp !== otp) {
        return { valid: false, error: 'Invalid OTP' };
    }

    // Valid - delete to prevent reuse
    deleteOTP(target);
    return { valid: true, error: null };
}

/**
 * Complete OTP flow: Generate, store, and send
 * @param {Object} params - Flow parameters
 * @param {string} params.target - Email or phone number
 * @param {string} params.type - 'email' or 'phone'
 * @param {Object} params.options - Additional options for email
 * @returns {Promise<{otp: string, sent: boolean, devMode: boolean}>}
 */
async function generateAndSendOTP({ target, type, options = {} }) {
    const otp = generateOTP();
    storeOTP(target, otp);

    const sendResult = await sendOTPByType({ target, type, otp, options });

    return {
        otp, // Include for testing/dev purposes
        sent: sendResult.success,
        devMode: sendResult.devMode
    };
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
    // Core functions
    generateOTP,
    storeOTP,
    getOTP,
    deleteOTP,
    verifyOTP,

    // Sending functions
    sendOTPEmail,
    sendOTPSMS,
    sendOTPByType,

    // High-level workflow
    generateAndSendOTP
};
