// server/utils/sendOTP.js
const twilio = require("twilio");
const logger = require("./logger");

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

async function sendOTP(phone, otp) {
    if (process.env.NODE_ENV !== "production") {
        console.log("📱 OTP (DEV):", phone, otp);
        return;
    }

    try {
        await client.messages.create({
            body: `Your Chttrix verification code is ${otp}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone,
        });

        logger.success(`OTP sent → ${phone}`);
    } catch (err) {
        logger.error("TWILIO ERROR ❌", err);
        throw err;
    }
}

module.exports = { sendOTP };
