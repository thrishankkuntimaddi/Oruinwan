#!/usr/bin/env node
'use strict';

/**
 * Checks the email setup end to end without printing any secret.
 *
 *   npm run email:check                      static checks + Brevo account/sender lookup
 *   npm run email:check -- --send you@x.com  also sends one test email
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const axios = require('axios');
const { diagnoseEmailConfig, resolveSender } = require('../utils/emailConfig');

const sendIdx = process.argv.indexOf('--send');
const sendTo = sendIdx > -1 ? process.argv[sendIdx + 1] : null;

function print(level, message) {
  const tag = { ok: '✔', warn: '⚠', error: '✖', info: '•' }[level] || '•';
  console.log(`${tag} ${message}`);
}

async function checkBrevo(sender) {
  const headers = { 'api-key': process.env.BREVO_API_KEY, accept: 'application/json' };
  let failed = false;
  try {
    const { data } = await axios.get('https://api.brevo.com/v3/account', { headers, timeout: 8000 });
    const plan = (data.plan || []).map((p) => `${p.type}${p.credits != null ? ` (${p.credits} credits)` : ''}`).join(', ');
    print('ok', `Brevo API key accepted${plan ? ` — plan: ${plan}` : ''}`);
  } catch (err) {
    failed = true;
    const detail = err.response?.data?.message || err.message;
    print('error', `Brevo rejected the API key: ${detail}`);
    if (/ip/i.test(detail)) {
      print('info', 'Turn off Brevo > Security > Authorised IPs, or add this server\'s IP there.');
    }
    return failed;
  }

  try {
    const { data } = await axios.get('https://api.brevo.com/v3/senders', { headers, timeout: 8000 });
    const match = (data.senders || []).find((s) => s.email?.toLowerCase() === sender.email.toLowerCase());
    if (!match) {
      failed = true;
      print('error', `Sender ${sender.email} is not registered in Brevo. Add it under Senders, Domains & Dedicated IPs > Senders (and authenticate its domain).`);
    } else if (match.active === false) {
      failed = true;
      print('error', `Sender ${sender.email} exists in Brevo but is not verified/active yet.`);
    } else {
      print('ok', `Sender ${sender.email} is registered and active in Brevo.`);
    }
  } catch (err) {
    print('warn', `Could not list Brevo senders: ${err.response?.data?.message || err.message}`);
  }

  try {
    const domain = sender.email.split('@')[1];
    const { data } = await axios.get(`https://api.brevo.com/v3/senders/domains/${encodeURIComponent(domain)}`, { headers, timeout: 8000 });
    if (data.authenticated) print('ok', `Domain ${domain} is authenticated (SPF/DKIM) in Brevo.`);
    else print('warn', `Domain ${domain} is not authenticated in Brevo; add the DNS records Brevo shows for it.`);
  } catch (err) {
    const status = err.response?.status;
    if (status === 404) print('warn', `Domain ${sender.email.split('@')[1]} is not added in Brevo > Domains.`);
    else print('warn', `Could not check domain authentication: ${err.response?.data?.message || err.message}`);
  }
  return failed;
}

(async () => {
  const sender = resolveSender();
  print('info', `Sender: ${sender.name} <${sender.email}>`);

  const issues = diagnoseEmailConfig();
  for (const { level, message } of issues) print(level, message);
  if (!issues.length) print('ok', 'Static configuration looks right.');
  let failed = issues.some((i) => i.level === 'error');

  if (process.env.BREVO_API_KEY) {
    failed = (await checkBrevo(sender)) || failed;
  }

  if (sendTo) {
    const sendEmail = require('../utils/sendEmail');
    try {
      const out = await sendEmail({
        to: sendTo,
        subject: 'Oruinwan email check',
        text: 'This is a test message from scripts/email-check.js. If you can read it, email delivery works.',
      });
      print('ok', `Test email accepted by ${out.provider} (${out.id || 'no id'}). Check the inbox and spam folder of ${sendTo}.`);
    } catch (err) {
      failed = true;
      print('error', err.message);
    }
  }

  process.exit(failed ? 1 : 0);
})();
