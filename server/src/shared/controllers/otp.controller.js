const otpService = require("../services/otp.service");
const otpStore = require("../services/otpStore");
const { handleError } = require("../../../utils/responseHelpers");
const identity = require("../../identity");
const { query } = require("../postgres");

const OTP_TYPES = ["email", "phone"];
const PHONE_RE = /^\+?[0-9]{7,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function otpError(res, err, context) {
    const status = err && (err.status || err.statusCode);
    if (status === 429 || status === 502) {
        return res.status(status).json({ message: err.message });
    }
    return handleError(res, err, context);
}

// Caller must be owner/admin of the company they are acting on.
async function assertCompanyAdmin(req, companyId) {
    const userId = req.user && (req.user.sub || req.user._id);
    if (!userId) return false;
    const user = await identity.users.findById(userId);
    return !!user && !!user.companyId && String(user.companyId) === String(companyId)
        && ["owner", "admin"].includes(user.companyRole);
}

exports.sendOtp = async (req, res) => {
    try {
        const { target, type } = req.body;
        if (!target || typeof target !== "string") return res.status(400).json({ message: "Target is required" });
        if (!OTP_TYPES.includes(type)) return res.status(400).json({ message: "Invalid OTP type" });
        if (type === "email" && !EMAIL_RE.test(target)) return res.status(400).json({ message: "Invalid email" });
        if (type === "phone" && !PHONE_RE.test(target.replace(/[\s-]/g, ""))) return res.status(400).json({ message: "Invalid phone" });

        const result = await otpService.generateAndSendOTP({ target, type });

        return res.json({
            message: "OTP sent successfully",
            ...(result.devMode ? { devNote: "OTP delivery is not configured in this environment" } : {})
        });
    } catch (err) {
        return otpError(res, err, "SEND OTP ERROR");
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { target, otp } = req.body;

        if (!target || !otp || typeof target !== "string") {
            return res.status(400).json({ message: "Target and OTP are required" });
        }

        const result = otpService.verifyOTP(target, String(otp));

        if (!result.valid) {
            return res.status(400).json({ message: result.error });
        }

        return res.json({ message: "Verified successfully", verified: true });

    } catch (err) {
        return handleError(res, err, "VERIFY OTP ERROR");
    }
};

const phoneKey = (companyId) => `company-phone:${companyId}`;

exports.sendPhoneOtp = async (req, res) => {
    try {
        const { phone, companyId } = req.body;

        if (!phone || !companyId || typeof phone !== "string") {
            return res.status(400).json({ message: "Phone and company ID are required" });
        }
        if (!PHONE_RE.test(phone.replace(/[\s-]/g, ""))) {
            return res.status(400).json({ message: "Invalid phone" });
        }
        if (!(await assertCompanyAdmin(req, companyId))) {
            return res.status(403).json({ message: "Access denied" });
        }

        const company = await identity.companies.findById(companyId);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        otpService.checkSendThrottle(phoneKey(companyId));
        const otp = otpService.generateOTP();
        // Phone is only written to the company after successful verification.
        otpStore.set(phoneKey(companyId), { otp, phone, expires: Date.now() + 5 * 60 * 1000, attempts: 0 }, 5 * 60 * 1000);

        const sendResult = await otpService.sendOTPByType({ target: phone, type: "phone", otp });
        if (!sendResult.success) {
            otpStore.delete(phoneKey(companyId));
            return res.status(502).json({ message: "Failed to deliver verification code" });
        }

        return res.json({ message: "OTP sent successfully" });
    } catch (err) {
        return otpError(res, err, "SEND PHONE OTP ERROR");
    }
};

exports.verifyPhoneOtp = async (req, res) => {
    try {
        const { companyId, otp } = req.body;

        if (!companyId || !otp) {
            return res.status(400).json({ message: "Company ID and OTP are required" });
        }
        if (!(await assertCompanyAdmin(req, companyId))) {
            return res.status(403).json({ message: "Access denied" });
        }

        const pending = otpStore.get(phoneKey(companyId));
        const phone = pending && pending.phone;
        const result = otpService.verifyOTP(phoneKey(companyId), String(otp));
        if (!result.valid) {
            return res.status(400).json({ message: result.error });
        }

        // companies.phone (jsonb) holds { ownerPhone, verified, otp, otpExpiresAt }.
        const { rowCount } = await query(
            `UPDATE companies SET phone = (COALESCE(phone, '{}'::jsonb) - 'otp' - 'otpExpiresAt') || $2::jsonb, updated_at = now() WHERE id = $1`,
            [String(companyId), JSON.stringify({ ownerPhone: phone, verified: true })]
        );
        if (!rowCount) {
            return res.status(404).json({ message: "Company not found" });
        }

        return res.json({
            message: "Phone verified successfully",
            verified: true
        });

    } catch (err) {
        return handleError(res, err, "VERIFY PHONE OTP ERROR");
    }
};
