const twilio = require("twilio");
const logger = require("./logger");

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

async function sendOTP(phone, otp) {
    
    console.log(`📱 Attempting to send OTP to ${phone}...`);

    
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
        console.error("❌ Twilio not configured! Missing credentials.");
        throw new Error("Twilio not configured");
    }

    try {
        const result = await client.messages.create({
            body: `Your Chttrix verification code is ${otp}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone,
        });

        console.log(`✅ SMS sent successfully! SID: ${result.sid}`);
        logger.success(`OTP sent → ${phone}`);
        return result;
    } catch (err) {
        console.error("❌ TWILIO ERROR Details:");
        console.error("  Message:", err.message);
        console.error("  Code:", err.code);
        console.error("  Status:", err.status);
        logger.error("TWILIO ERROR ❌", err);
        throw err;
    }
}

module.exports = { sendOTP };
