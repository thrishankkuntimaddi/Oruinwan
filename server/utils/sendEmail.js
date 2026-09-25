const logger = require('./logger');
const axios = require('axios');

/**
 * Transactional email with provider failover.
 *
 * Providers are tried in order until one succeeds:
 *   1. Brevo HTTP API       BREVO_API_KEY
 *   2. Primary SMTP         SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
 *   3. Backup SMTP          SMTP_FALLBACK_HOST / _PORT / _USER / _PASS (e.g. Gmail app password)
 *
 * Throws when no provider is configured or every configured provider fails,
 * so callers decide what to do (in development they log the link instead).
 */

const FROM_NAME = 'Chttrix';

function fromAddress() {
  return process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.SMTP_FALLBACK_USER || 'no-reply@chttrix.local';
}

function smtpConfig(prefix) {
  const host = process.env[`${prefix}_HOST`];
  const user = process.env[`${prefix}_USER`];
  if (!host || !user) return null;
  const port = Number(process.env[`${prefix}_PORT`] || 587);
  const secureEnv = process.env[`${prefix}_SECURE`];
  return {
    host,
    port,
    secure: secureEnv ? secureEnv === 'true' : port === 465,
    auth: { user, pass: process.env[`${prefix}_PASS`] },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
  };
}

function isEmailConfigured() {
  return Boolean(process.env.BREVO_API_KEY || smtpConfig('SMTP') || smtpConfig('SMTP_FALLBACK'));
}

// Brevo's "Authorised IPs" security option rejects API keys and SMTP logins
// from any IP not on the list. With a dynamic IP that means every send fails.
function isBrevoIpLock(detail) {
  return /unrecogni[sz]ed ip|unauthori[sz]ed ip/i.test(detail || '');
}

const BREVO_IP_HINT = 'Brevo is rejecting this server\'s IP. Turn off "Authorised IPs" at https://app.brevo.com/security/authorised_ips (Security > Authorised IPs) so sending works from any IP, or configure SMTP_FALLBACK_* with another provider.';

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
    { headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' }, timeout: 8000 }
  );
  return { provider: 'brevo', id: response.data?.messageId };
}

const transporters = new Map();
function smtpTransporter(prefix) {
  if (!transporters.has(prefix)) {
    const nodemailer = require('nodemailer');
    transporters.set(prefix, nodemailer.createTransport(smtpConfig(prefix)));
  }
  return transporters.get(prefix);
}

async function sendViaSmtp(prefix, { to, subject, text, html }) {
  try {
    const info = await smtpTransporter(prefix).sendMail({
      from: `"${FROM_NAME}" <${fromAddress()}>`,
      to,
      subject,
      text,
      html: html || text,
    });
    return { provider: prefix.toLowerCase(), id: info.messageId };
  } catch (err) {
    // A failed login or dead connection must not be reused by the next send.
    transporters.delete(prefix);
    throw err;
  }
}

let ipLockWarned = false;
function noteFailure(errors, provider, detail) {
  errors.push(`${provider}: ${detail}`);
  if (isBrevoIpLock(detail)) {
    if (!ipLockWarned) {
      ipLockWarned = true;
      logger.error(`📧 ${BREVO_IP_HINT}`);
    }
    logger.warn(`${provider} send blocked by Brevo Authorised IPs (${detail})`);
  } else {
    logger.warn(`${provider} send failed (${detail})`);
  }
}

async function sendEmail({ to, subject, text, html }) {
  if (!isEmailConfigured()) {
    throw new Error('Email not configured: set BREVO_API_KEY, SMTP_* or SMTP_FALLBACK_*');
  }

  const errors = [];

  if (process.env.BREVO_API_KEY) {
    try {
      const out = await sendViaBrevo({ to, subject, text, html });
      logger.info(`📧 Email sent to ${to} via Brevo (${out.id})`);
      return out;
    } catch (err) {
      noteFailure(errors, 'Brevo', err.response?.data?.message || err.message);
    }
  }

  for (const prefix of ['SMTP', 'SMTP_FALLBACK']) {
    if (!smtpConfig(prefix)) continue;
    try {
      const out = await sendViaSmtp(prefix, { to, subject, text, html });
      logger.info(`📧 Email sent to ${to} via ${prefix} (${out.id})`);
      return out;
    } catch (err) {
      noteFailure(errors, prefix, err.response || err.message);
    }
  }

  const summary = errors.join(' | ');
  throw new Error(`Email delivery failed: ${summary}${errors.some(isBrevoIpLock) ? `. ${BREVO_IP_HINT}` : ''}`);
}

module.exports = sendEmail;
module.exports.isEmailConfigured = isEmailConfigured;
