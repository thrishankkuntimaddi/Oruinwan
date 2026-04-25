const express = require("express");
const router = express.Router();
const otpController = require("../controllers/otp.controller");

router.post("/send", otpController.sendOtp);

router.post("/verify", otpController.verifyOtp);

router.post("/phone/send", otpController.sendPhoneOtp);

router.post("/phone/verify", otpController.verifyPhoneOtp);

module.exports = router;
