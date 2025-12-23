// server/utils/sendEmail.js
const nodemailer = require('nodemailer');

async function sendEmail({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST) {
    // Throw error so calling code can handle and log invitation links
    throw new Error('SMTP not configured');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html
  });
}

module.exports = sendEmail;
