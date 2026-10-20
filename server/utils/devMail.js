'use strict';

/**
 * Development mail outbox.
 *
 * Outside production (and outside tests) every outgoing email is also written to the
 * server console and appended to a local file, so a developer can finish sign-up,
 * company registration, password reset and invites without a real inbox:
 *
 *   tail -f "$(node -p "require('os').tmpdir()")/oruinwan-dev-mail.log"
 *
 * DEV_MAIL=console skips the real providers entirely (handy for made-up addresses such
 * as admin@northwind.test). Neither applies when NODE_ENV=production.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const logger = require('./logger');

function isDevMailEnv(env = process.env) {
  return env.NODE_ENV !== 'production' && env.NODE_ENV !== 'test';
}

/** True when real providers should be skipped and mail only goes to the dev outbox. */
function consoleOnly(env = process.env) {
  return isDevMailEnv(env) && String(env.DEV_MAIL || '').toLowerCase() === 'console';
}

function outboxFile(env = process.env) {
  return env.DEV_MAIL_FILE || path.join(os.tmpdir(), 'oruinwan-dev-mail.log');
}

/** Plain-text view of an email body: tags stripped, links kept as "text (url)". */
function toPlainText(html) {
  return String(html || '')
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => `${label.replace(/<[^>]+>/g, '').trim()} (${href})`)
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/** Writes the email to the console and the outbox file. No-op in production and tests. */
function recordDevMail({ to, subject, text, html }, env = process.env) {
  if (!isDevMailEnv(env)) return false;
  const body = (text && String(text).trim()) || toPlainText(html);
  const entry = [
    '='.repeat(72),
    `DEV MAIL ${new Date().toISOString()}`,
    `To:      ${to}`,
    `Subject: ${subject}`,
    '-'.repeat(72),
    body,
    '='.repeat(72),
    '',
  ].join('\n');
  logger.warn(`📬 Development outbox (not shown in production)\n${entry}`);
  try {
    fs.appendFileSync(outboxFile(env), `${entry}\n`);
  } catch (err) {
    logger.debug({ err: err.message }, 'Could not write the dev mail outbox file');
  }
  return true;
}

/** Same outbox for text messages (phone verification codes). No-op in production and tests. */
function recordDevSms(phone, body, env = process.env) {
  return recordDevMail({ to: `SMS ${phone}`, subject: 'Text message', text: body }, env);
}

module.exports = { recordDevMail, recordDevSms, consoleOnly, isDevMailEnv, outboxFile, toPlainText };
