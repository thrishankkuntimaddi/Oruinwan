const otpService = require("../services/otp.service");
const { handleError } = require("../../../utils/responseHelpers");
const Company = require("../../../models/Company");
const { sendOTP } = require("../../../utils/sendOTP");

exports.sendOtp = async (req, res) => {
    try {
        const { target, type } = req.body;
        if (!target) return res.status(400).json({ message: "Target is required" });

        
        const result = await otpService.generateAndSendOTP({ target, type });

        return res.json({
            message: "OTP sent successfully",
            ...(result.devMode ? { devNote: "Check server terminal for code" } : {})
        });
    } catch (err) {
        return handleError(res, err, "SEND OTP ERROR");
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { target, otp } = req.body;

        if (!target || !otp) {
            return res.status(400).json({ message: "Target and OTP are required" });
        }

        
        const result = otpService.verifyOTP(target, otp);

        if (!result.valid) {
            return res.status(400).json({ message: result.error });
        }

        return res.json({ message: "Verified successfully", verified: true });

    } catch (err) {
        return handleError(res, err, "VERIFY OTP ERROR");
    }
};

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

        
        const otp = Math.floor(100000 + Math.random() * 900000);

        
        company.ownerPhone = phone;
        company.phoneOTP = otp.toString();
        company.phoneOTPExpiresAt = Date.now() + 5 * 60 * 1000; 
        await company.save();

        
        let formattedPhone = phone;
        if (!formattedPhone.startsWith('+')) {
            formattedPhone = `+91${formattedPhone}`;
        }

        
        await sendOTP(formattedPhone, otp);

        return res.json({
            message: "OTP sent successfully",
            devNote: process.env.NODE_ENV !== "production" ? "Check server terminal for code" : undefined
        });
    } catch (err) {
        return handleError(res, err, "SEND PHONE OTP ERROR");
    }
};

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

        
        if (!company.phoneOTP || !company.phoneOTPExpiresAt) {
            return res.status(400).json({ message: "OTP not found. Please request a new one." });
        }

        
        if (Date.now() > company.phoneOTPExpiresAt) {
            company.phoneOTP = undefined;
            company.phoneOTPExpiresAt = undefined;
            await company.save();
            return res.status(400).json({ message: "OTP expired. Please request a new one." });
        }

        
        if (company.phoneOTP !== otp) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        
        company.phoneVerified = true;
        company.phoneOTP = undefined;
        company.phoneOTPExpiresAt = undefined;
        await company.save();

        return res.json({
            message: "Phone verified successfully",
            verified: true
        });

    } catch (err) {
        return handleError(res, err, "VERIFY PHONE OTP ERROR");
    }
};
