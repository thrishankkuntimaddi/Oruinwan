// server/utils/emailTemplates/auth.js
// Authentication email templates — Chttrix dark theme

const YEAR = new Date().getFullYear();
const APP = 'Chttrix';

// ─── Design Tokens (inline-only for email client compat) ─────────────────────
const T = {
  bgOuter:     '#f0ece6',
  bgCard:      '#ffffff',
  bgHeader:    '#faf8f5',
  bgSection:   '#f5f2ee',
  accent:      '#b8956a',
  accentDark:  '#8a6a4a',
  textPrimary: '#1a1a1a',
  textSub:     '#555555',
  textMuted:   '#888888',
  textDanger:  '#c0392b',
  textSuccess: '#1e8a5e',
  border:      '#e8e2da',
  borderAccent:'rgba(184,149,106,0.35)',
};

// ─── Shell ────────────────────────────────────────────────────────────────────
function shell({ icon, title, subtitle, body, preheader = '' }) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${title}</title>
  <style>
    @media only screen and (max-width:600px){
      .ec{width:100%!important;}
      .ep{padding:24px 18px!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${T.bgOuter};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,Helvetica,Arial,sans-serif">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:${T.bgOuter};line-height:1px">
    ${preheader || title}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <!-- Outer -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.bgOuter}">
    <tr>
      <td align="center" style="padding:40px 16px 60px">

        <!-- Card -->
        <table class="ec" role="presentation" width="580" cellpadding="0" cellspacing="0" border="0"
          style="max-width:580px;width:100%;background-color:${T.bgCard};border:1px solid ${T.border}">

          <!-- Logo header -->
          <tr>
            <td bgcolor="${T.bgHeader}" style="padding:18px 32px;border-bottom:1px solid ${T.border}">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:17px;font-weight:800;color:${T.textPrimary};letter-spacing:-0.03em">${APP}</span>
                    <span style="font-size:10px;font-weight:600;color:${T.accent};letter-spacing:0.2em;text-transform:uppercase;margin-left:10px">AI Collaboration</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Gold stripe -->
          <tr>
            <td height="2" bgcolor="${T.accent}" style="font-size:0;line-height:0">&nbsp;</td>
          </tr>

          <!-- Hero -->
          <tr>
            <td class="ep" style="padding:40px 32px 24px;border-bottom:1px solid ${T.border}">
              <p style="margin:0 0 12px;font-size:38px;line-height:1">${icon}</p>
              <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:${T.textPrimary};letter-spacing:-0.02em;line-height:1.3">${title}</h1>
              <p style="margin:0;font-size:14px;color:${T.textSub};line-height:1.6">${subtitle}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="ep" style="padding:32px">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="${T.bgHeader}" style="padding:18px 32px;border-top:1px solid ${T.border}">
              <p style="margin:0 0 4px;font-size:12px;color:${T.textMuted};line-height:1.5">This is an automated message from ${APP}. Please do not reply.</p>
              <p style="margin:0;font-size:12px;color:#888888">&copy; ${YEAR} ${APP} Inc. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─── Partials ─────────────────────────────────────────────────────────────────
function btn(text, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0">
  <tr>
    <td style="background-color:${T.accent};padding:14px 32px">
      <a href="${url}" style="font-size:14px;font-weight:700;color:#000;text-decoration:none;letter-spacing:0.03em;white-space:nowrap">${text} &rarr;</a>
    </td>
  </tr>
</table>`;
}

function otp(code) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto">
  <tr>
    <td align="center" bgcolor="${T.bgSection}"
      style="padding:22px 48px;border:1px solid ${T.borderAccent}">
      <span style="font-size:40px;font-weight:800;letter-spacing:0.28em;color:${T.accent};font-family:'Courier New',Courier,monospace">${code}</span>
    </td>
  </tr>
</table>`;
}

function infoCard(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:${T.bgSection};border:1px solid ${T.border};margin:20px 0">
  <tr><td style="padding:16px 20px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${rows}
    </table>
  </td></tr>
</table>`;
}

function row(label, value, highlight = false) {
  return `<tr>
  <td style="padding:10px 0;border-bottom:1px solid ${T.border};font-size:13px;color:${T.textSub};width:140px;vertical-align:top">${label}</td>
  <td style="padding:10px 0;border-bottom:1px solid ${T.border};font-size:13px;color:${highlight ? T.accent : T.textPrimary};font-weight:${highlight ? '700' : '500'};font-family:${highlight ? "'Courier New',Courier,monospace" : 'inherit'};letter-spacing:${highlight ? '0.06em' : '0'}">${value}</td>
</tr>`;
}

function alert(text, kind = 'info') {
  const map = {
    info:    { bg: 'rgba(184,149,106,0.07)', border: T.accentDark, clr: T.accent },
    warning: { bg: 'rgba(255,190,50,0.07)',  border: '#b8860b',    clr: '#7a5c00' },
    danger:  { bg: 'rgba(224,82,82,0.07)',   border: '#993333',    clr: T.textDanger },
    success: { bg: 'rgba(77,184,142,0.07)',  border: '#2d7d5c',    clr: T.textSuccess },
  };
  const c = map[kind] || map.info;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:${c.bg};border-left:3px solid ${c.border};margin:24px 0">
  <tr>
    <td style="padding:14px 18px;font-size:13px;color:${c.clr};line-height:1.6">${text}</td>
  </tr>
</table>`;
}

function p(text, { size = '14px', color = T.textSub, mt = '0', mb = '16px' } = {}) {
  return `<p style="margin:${mt} 0 ${mb};font-size:${size};color:${color};line-height:1.7">${text}</p>`;
}

function link(text, url) {
  return `<p style="margin:0;font-size:13px;color:${T.textMuted};line-height:1.6;word-break:break-all">
  Or copy this link: <a href="${url}" style="color:${T.accent};text-decoration:none">${url}</a>
</p>`;
}

// ─── Generate Verification Code ───────────────────────────────────────────────
const generateVerificationCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// ─── 1. Email Verification OTP ────────────────────────────────────────────────
const emailVerificationTemplate = (username, code) => {
  const body = `
    ${p(`Hi <strong style="color:${T.textPrimary}">${username}</strong>,`)}
    ${p('Use the verification code below to confirm your email address on Chttrix:', { mb: '4px' })}
    ${otp(code)}
    ${p(`This code expires in <strong style="color:${T.textPrimary}">15 minutes</strong>. If you didn't request this, you can safely ignore this email.`, { size: '13px', color: T.textMuted, mb: '0' })}
  `;
  return {
    subject: `Your Chttrix Verification Code: ${code}`,
    html: shell({
      icon: '✉️',
      title: 'Email Verification Code',
      subtitle: 'Enter this code in Chttrix to verify your email address.',
      preheader: `Your Chttrix verification code is ${code}. Expires in 15 minutes.`,
      body,
    }),
    text: `Hi ${username},\n\nYour Chttrix email verification code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you didn't request this, please ignore this email.\n\n— The Chttrix Team`,
  };
};

// ─── 2. Password Reset ────────────────────────────────────────────────────────
const passwordResetTemplate = (username, resetUrl) => {
  const body = `
    ${p(`Hi <strong style="color:${T.textPrimary}">${username}</strong>,`)}
    ${p('We received a request to reset your Chttrix account password. Click the button below to choose a new password.')}
    ${btn('Reset Password', resetUrl)}
    ${link('Reset your password', resetUrl)}
    ${alert('<strong>Security note:</strong> This link expires in <strong>1 hour</strong>. If you did not request a password reset, please ignore this email — your account remains secure.', 'warning')}
  `;
  return {
    subject: `Reset your Chttrix password`,
    html: shell({
      icon: '🔑',
      title: 'Reset Your Password',
      subtitle: 'A password reset was requested for your account.',
      preheader: `Hi ${username}, click inside to reset your Chttrix password (expires in 1 hour).`,
      body,
    }),
    text: `Hi ${username},\n\nReset your Chttrix password here: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.\n\n— The Chttrix Team`,
  };
};

// ─── 3. Password Set (OAuth users) ───────────────────────────────────────────
const passwordSetTemplate = (username, authProvider) => {
  const provider = authProvider
    ? authProvider.charAt(0).toUpperCase() + authProvider.slice(1)
    : 'OAuth';
  const body = `
    ${p(`Hi <strong style="color:${T.textPrimary}">${username}</strong>,`)}
    ${p(`You've successfully added password login to your Chttrix account. You can now sign in with either your <strong style="color:${T.textPrimary}">${provider}</strong> account or your email and password.`)}
    ${alert('If you did not set a password on your account, your account may have been accessed without authorisation. Please change your password immediately and contact support.', 'danger')}
  `;
  return {
    subject: `Password login enabled on your Chttrix account`,
    html: shell({
      icon: '🔐',
      title: 'Password Login Enabled',
      subtitle: `Password login was added to your ${provider} account.`,
      preheader: `Password login is now enabled on your Chttrix account, ${username}.`,
      body,
    }),
    text: `Hi ${username},\n\nPassword login has been enabled on your Chttrix account (via ${provider}).\n\nIf this wasn't you, please contact support immediately.\n\n— The Chttrix Team`,
  };
};

// ─── 4. Resend / Account Activation ──────────────────────────────────────────
const resendVerificationTemplate = (username, verificationUrl) => {
  const body = `
    ${p(`Hi <strong style="color:${T.textPrimary}">${username}</strong>,`)}
    ${p('Your Chttrix account is almost ready! Click the button below to verify your email and activate your account.')}
    ${btn('Verify Email Address', verificationUrl)}
    ${link('Verify your email', verificationUrl)}
    ${alert('This verification link expires in <strong>24 hours</strong>. If you did not create a Chttrix account, you can safely ignore this email.', 'info')}
  `;
  return {
    subject: `Verify your Chttrix email address`,
    html: shell({
      icon: '📬',
      title: 'Verify Your Email',
      subtitle: 'One click to activate your Chttrix account.',
      preheader: `Hi ${username}, please verify your email to get started on Chttrix.`,
      body,
    }),
    text: `Hi ${username},\n\nVerify your Chttrix email here: ${verificationUrl}\n\nThis link expires in 24 hours.\n\n— The Chttrix Team`,
  };
};

module.exports = {
  generateVerificationCode,
  emailVerificationTemplate,
  passwordResetTemplate,
  passwordSetTemplate,
  resendVerificationTemplate,
};
