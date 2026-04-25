const axios = require("axios");

async function sendEmail({ to, subject, text, html }) {

  
  if (!process.env.BREVO_API_KEY) {
    console.error("❌ BREVO_API_KEY not configured");
    throw new Error("BREVO_API_KEY not configured");
  }

  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Chttrix",
          email: process.env.EMAIL_FROM || "chttrixchat@gmail.com",
        },
        to: [{ email: to }],
        subject,
        htmlContent: html || text,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 5000, 
      }
    );

    console.log(`📧 Email sent successfully to ${to} (ID: ${response.data.messageId})`);
    return response.data;
  } catch (error) {
    console.error("❌ Brevo API Error:", error.response?.data || error.message);
    throw new Error(`Brevo email failed: ${error.response?.data?.message || error.message}`);
  }
}

module.exports = sendEmail;
