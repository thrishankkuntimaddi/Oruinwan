'use strict';

const sendEmail = require('../../../utils/sendEmail');
const { sendOTP } = require('../../../utils/sendOTP');
const otpStore = require('./otpStore');
const logger = require('../utils/logger');

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function storeOTP(target, otp, expiryMinutes = 5) {
  otpStore.set(target, { otp, expires: Date.now() + expiryMinutes * 60 * 1000 }, expiryMinutes * 60 * 1000);
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
    
    logger.warn(
      { type, target, err: error.message },
      `OTP delivery failed — DEV fallback active. OTP for ${target}: ${otp}`
    );
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

  if (data.otp !== otp) {
    return { valid: false, error: 'Invalid OTP' };
  }

  
  deleteOTP(target);
  return { valid: true, error: null };
}

async function generateAndSendOTP({ target, type, options = {} }) {
  const otp = generateOTP();
  storeOTP(target, otp);

  const sendResult = await sendOTPByType({ target, type, otp, options });

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

  
  sendOTPEmail,
  sendOTPSMS,
  sendOTPByType,

  
  generateAndSendOTP,
};
