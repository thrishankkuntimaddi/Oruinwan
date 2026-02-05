// src/shared/controllers/otp.controller.js

const otpService = require("../services/otp.service");
const { handleError } = require("../../../utils/responseHelpers");
const Company = require("../../../models/Company");
const { sendOTP } = require("../../../utils/sendOTP");

/**
 * Send OTP (Dev Mode: Logs to Terminal)
 * POST /api/otp/send
 * Body: { target: string, type: 'email' | 'phone' }
 */
exports.sendOtp = async (req, res) => {
    try {
        const { target, type } = req.body;
        if (!target) return res.status(400).json({ message: "Target is required" });

        // Use shared OTP service
        const result = await otpService.generateAndSendOTP({ target, type });

        return res.json({
            message: "OTP sent successfully",
            ...(result.devMode ? { devNote: "Check server terminal for code" } : {})
        });
    } catch (_err) {
        return handleError(res, err, "SEND OTP ERROR");
    }
};

/**
 * Verify OTP
 * POST /api/otp/verify
 * Body: { target: string, otp: string }
 */
exports.verifyOtp = async (req, res) => {
    try {
        const { target, otp } = req.body;

        if (!target || !otp) {
            return res.status(400).json({ message: "Target and OTP are required" });
        }

        // Use shared OTP service
        const result = otpService.verifyOTP(target, otp);

        if (!result.valid) {
            return res.status(400).json({ message: result.error });
        }

        return res.json({ message: "Verified successfully", verified: true });

    } catch (_err) {
        return handleError(res, err, "VERIFY OTP ERROR");
    }
};

/**
 * Send Phone OTP during company registration
 * POST /api/otp/phone/send
 * Body: { phone: string, companyId: string }
 */
exports.sendPhoneOtp = async (req, res) => {
    try {
        const { phone, companyId } = req.body;

        if (!phone || !companyId) {
            return res.status(400).json({ message: "Phone and company ID are required" });
        }

        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000);

        // Store OTP in company document
        company.ownerPhone = phone;
        company.phoneOTP = otp.toString();
        company.phoneOTPExpiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
        await company.save();

        // Format phone number to E.164 format for Twilio
        let formattedPhone = phone;
        if (!formattedPhone.startsWith('+')) {
            formattedPhone = `+91${formattedPhone}`;
        }

        // Send OTP via Twilio
        await sendOTP(formattedPhone, otp);

        return res.json({
            message: "OTP sent successfully",
            devNote: process.env.NODE_ENV !== "production" ? "Check server terminal for code" : undefined
        });
    } catch (_err) {
        return handleError(res, err, "SEND PHONE OTP ERROR");
    }
};

/**
 * Verify Phone OTP during company registration
 * POST /api/otp/phone/verify
 * Body: { companyId: string, otp: string }
 */
exports.verifyPhoneOtp = async (req, res) => {
    try {
        const { companyId, otp } = req.body;

        if (!companyId || !otp) {
            return res.status(400).json({ message: "Company ID and OTP are required" });
        }

        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        // Check if OTP exists and is valid
        if (!company.phoneOTP || !company.phoneOTPExpiresAt) {
            return res.status(400).json({ message: "OTP not found. Please request a new one." });
        }

        // Check if OTP is expired
        if (Date.now() > company.phoneOTPExpiresAt) {
            company.phoneOTP = undefined;
            company.phoneOTPExpiresAt = undefined;
            await company.save();
            return res.status(400).json({ message: "OTP expired. Please request a new one." });
        }

        // Verify OTP
        if (company.phoneOTP !== otp) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        // Mark as verified and clear OTP
        company.phoneVerified = true;
        company.phoneOTP = undefined;
        company.phoneOTPExpiresAt = undefined;
        await company.save();

        return res.json({
            message: "Phone verified successfully",
            verified: true
        });

    } catch (_err) {
        return handleError(res, err, "VERIFY PHONE OTP ERROR");
    }
};
