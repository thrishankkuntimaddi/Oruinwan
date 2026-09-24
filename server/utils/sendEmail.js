const logger = require('./logger');
const axios = require('axios');

/**
 * Transactional email.
 *
 * Order: Brevo HTTP API (BREVO_API_KEY) → SMTP (SMTP_HOST/PORT/USER/PASS).
 * Throws when no provider is configured or every configured provider fails,
 * so callers decide what to do (in development they log the link instead).
 */

const FROM_NAME = 'Chttrix';

function fromAddress() {
  return process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@chttrix.local';
}

function isEmailConfigured() {
  return Boolean(process.env.BREVO_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER));
}

async function sendViaBrevo({ to, subject, text, html }) {
  const response = await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { name: FROM_NAME, email: fromAddress() },
      to: [{ email: to }],
      subject,
      htmlContent: html || text,
      textContent: text || undefined,
    },
    { headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' }, timeout: 5000 }
  );
  return { provider: 'brevo', id: response.data?.messageId };
}

let _transporter = null;
function smtpTransporter() {
  if (!_transporter) {
    const nodemailer = require('nodemailer');
    const port = Number(process.env.SMTP_PORT || 587);
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: 8000,
    });
  }
  return _transporter;
}

async function sendViaSmtp({ to, subject, text, html }) {
  const info = await smtpTransporter().sendMail({
    from: `"${FROM_NAME}" <${fromAddress()}>`,
    to,
    subject,
    text,
    html: html || text,
  });
  return { provider: 'smtp', id: info.messageId };
}

async function sendEmail({ to, subject, text, html }) {
  if (!isEmailConfigured()) {
    throw new Error('Email not configured: set BREVO_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS');
  }

  const errors = [];

  if (process.env.BREVO_API_KEY) {
    try {
      const out = await sendViaBrevo({ to, subject, text, html });
      logger.info(`📧 Email sent to ${to} via Brevo (${out.id})`);
      return out;
    } catch (err) {
      const detail = err.response?.data?.message || err.message;
      errors.push(`Brevo: ${detail}`);
      logger.warn(`Brevo send failed (${detail})${process.env.SMTP_HOST ? ', trying SMTP' : ''}`);
    }
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    try {
      const out = await sendViaSmtp({ to, subject, text, html });
      logger.info(`📧 Email sent to ${to} via SMTP (${out.id})`);
      return out;
    } catch (err) {
      errors.push(`SMTP: ${err.message}`);
      logger.warn(`SMTP send failed (${err.message})`);
    }
  }

  throw new Error(`Email delivery failed: ${errors.join(' | ')}`);
}

module.exports = sendEmail;
module.exports.isEmailConfigured = isEmailConfigured;
