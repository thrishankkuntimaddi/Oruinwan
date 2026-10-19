const logger = require("./logger");

// Built on first use, not at load: Twilio rejects a placeholder account SID by throwing,
// which used to crash the whole server at boot when SMS wasn't even in use.
let client = null;
function twilioClient() {
    if (!client) client = require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    return client;
}

async function sendOTP(phone, otp) {
    logger.info("📱 Sending an SMS code");

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
        logger.error("❌ Twilio not configured! Missing credentials.");
        throw new Error("Twilio not configured");
    }

    try {
        const result = await twilioClient().messages.create({
            body: `Your Oruinwan verification code is ${otp}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone,
        });

        logger.info(`✅ SMS sent successfully! SID: ${result.sid}`);
        return result;
    } catch (err) {
        logger.error("❌ TWILIO ERROR Details:");
        logger.error("  Message:", err.message);
        logger.error("  Code:", err.code);
        logger.error("  Status:", err.status);
        logger.error("TWILIO ERROR ❌", err);
        throw err;
    }
}

module.exports = { sendOTP };
