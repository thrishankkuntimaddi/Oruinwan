// server/utils/sendEmail.js
const nodemailer = require('nodemailer');

async function sendEmail({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST) {
    console.log('SMTP not configured — skipping sending email. Would send to:', to, subject);
    return;
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
