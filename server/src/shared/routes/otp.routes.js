// src/shared/routes/otp.routes.js

const express = require("express");
const router = express.Router();
const otpController = require("../controllers/otp.controller");

/**
 * @route   POST /api/otp/send
 * @desc    Send OTP to email/phone (Logs to terminal in dev)
 * @access  Public
 */
router.post("/send", otpController.sendOtp);

/**
 * @route   POST /api/otp/verify
 * @desc    Verify OTP
 * @access  Public
 */
router.post("/verify", otpController.verifyOtp);

/**
 * @route   POST /api/otp/phone/send
 * @desc    Send Phone OTP during company registration
 * @body    phone, companyId
 * @access  Public
 */
router.post("/phone/send", otpController.sendPhoneOtp);

/**
 * @route   POST /api/otp/phone/verify
 * @desc    Verify Phone OTP during company registration
 * @body    companyId, otp
 * @access  Public
 */
router.post("/phone/verify", otpController.verifyPhoneOtp);

module.exports = router;
