const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const otpController = require("../controllers/otp.controller");
const requireAuth = require("../middleware/auth");

// Per-IP limits (per-target throttling and attempt caps live in otp.service).
const otpSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many OTP requests. Please try again later." },
});

const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many verification attempts. Please try again later." },
});

router.post("/send", otpSendLimiter, otpController.sendOtp);

router.post("/verify", otpVerifyLimiter, otpController.verifyOtp);

router.post("/phone/send", requireAuth, otpSendLimiter, otpController.sendPhoneOtp);

router.post("/phone/verify", requireAuth, otpVerifyLimiter, otpController.verifyPhoneOtp);

router.otpSendLimiter = otpSendLimiter;
router.otpVerifyLimiter = otpVerifyLimiter;

module.exports = router;
