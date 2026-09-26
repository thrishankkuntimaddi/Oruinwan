'use strict';

/**
 * Email configuration parsing and self-checks, shared by sendEmail.js, the
 * startup log and scripts/email-check.js.
 */

const DEFAULT_FROM_NAME = 'Oruinwan';

// Mailbox providers that publish a strict DMARC policy: mail "from" these
// domains relayed through Brevo fails DMARC and is rejected or spam-foldered.
const FREEMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'outlook.com',
  'hotmail.com', 'live.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
]);

/**
 * Accepts "addr@x.com", "Name <addr@x.com>" or "\"Name\" <addr@x.com>".
 * Returns { name, email } or null when no address can be found.
 */
function parseFrom(raw, fallbackName = DEFAULT_FROM_NAME) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const angled = value.match(/^\s*"?([^"<]*?)"?\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
  if (angled) {
    return { name: angled[1].trim() || fallbackName, email: angled[2] };
  }
  if (/^[^\s<>@]+@[^\s<>@]+$/.test(value)) {
    return { name: fallbackName, email: value };
  }
  return null;
}

/** The sender to use for outgoing mail. */
function resolveSender(env = process.env) {
  const name = env.EMAIL_FROM_NAME || DEFAULT_FROM_NAME;
  return (
    parseFrom(env.EMAIL_FROM, name) ||
    parseFrom(env.SMTP_USER, name) ||
    parseFrom(env.SMTP_FALLBACK_USER, name) ||
    { name, email: 'no-reply@chttrix.local' }
  );
}

function domainOf(email) {
  return String(email || '').split('@')[1]?.toLowerCase() || '';
}

/**
 * Static checks that need no network. Returns [{ level: 'error'|'warn', message }].
 * Values are never echoed back, only their shape.
 */
function diagnoseEmailConfig(env = process.env) {
  const issues = [];
  const hasBrevoApi = Boolean(env.BREVO_API_KEY);
  const hasSmtp = Boolean(env.SMTP_HOST && env.SMTP_USER);
  const hasFallback = Boolean(env.SMTP_FALLBACK_HOST && env.SMTP_FALLBACK_USER);

  if (!hasBrevoApi && !hasSmtp && !hasFallback) {
    issues.push({ level: 'error', message: 'No email provider configured: set BREVO_API_KEY (recommended), SMTP_* or SMTP_FALLBACK_*.' });
    return issues;
  }

  if (hasBrevoApi && !String(env.BREVO_API_KEY).startsWith('xkeysib-')) {
    issues.push({ level: 'error', message: 'BREVO_API_KEY does not look like a Brevo API v3 key (expected it to start with "xkeysib-"). Create one under Brevo > SMTP & API > API Keys.' });
  }

  if (env.EMAIL_FROM && !parseFrom(env.EMAIL_FROM)) {
    issues.push({ level: 'error', message: 'EMAIL_FROM is not a valid address. Use "noreply@yourdomain.com" or "Oruinwan <noreply@yourdomain.com>".' });
  }

  const sender = resolveSender(env);
  if (!env.EMAIL_FROM) {
    issues.push({ level: 'warn', message: `EMAIL_FROM is not set; mail will be sent from ${sender.email}. Set it to an address on a domain you have authenticated in Brevo.` });
  }
  if (FREEMAIL_DOMAINS.has(domainOf(sender.email))) {
    issues.push({
      level: 'error',
      message: `The sender address is on ${domainOf(sender.email)}. That domain's DMARC policy makes receivers reject or spam-folder mail relayed through Brevo. Authenticate your own domain in Brevo (Senders, Domains & Dedicated IPs > Domains: add the SPF/DKIM/DMARC records) and send from e.g. noreply@yourdomain.com.`,
    });
  }

  const smtpIsBrevo = /brevo\.com|sendinblue\.com/i.test(env.SMTP_HOST || '');
  if (hasSmtp && smtpIsBrevo && env.SMTP_PASS && !String(env.SMTP_PASS).startsWith('xsmtpsib-')) {
    issues.push({ level: 'warn', message: 'SMTP_HOST is Brevo\'s relay but SMTP_PASS does not look like a Brevo SMTP key (expected "xsmtpsib-..."). Generate one under Brevo > SMTP & API > SMTP; the account password does not work.' });
  }
  if (hasSmtp && !env.SMTP_PASS) {
    issues.push({ level: 'error', message: 'SMTP_HOST/SMTP_USER are set but SMTP_PASS is empty.' });
  }

  return issues;
}

module.exports = { parseFrom, resolveSender, diagnoseEmailConfig, FREEMAIL_DOMAINS, DEFAULT_FROM_NAME };
