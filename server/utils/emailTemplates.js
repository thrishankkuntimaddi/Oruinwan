/**
 * server/utils/emailTemplates.js
 *
 * Chttrix — Unified Premium Email Template System
 * Monolith Flow Design Language
 *
 * Design tokens:
 *   --bg-base:        #080808
 *   --bg-card:        #111111
 *   --bg-header:      #0c0c0c
 *   --accent:         #b8956a  (amber/gold)
 *   --accent-light:   #d4a97a
 *   --text-primary:   #e4e4e4
 *   --text-secondary: #9a9a9a
 *   --text-muted:     #5a5a5a
 *   --border:         #1e1e1e
 *
 * All templates return { subject, html, text }.
 * Use inline styles only — CSS classes are stripped by Gmail.
 * Use table-based layout for max email client compatibility.
 */

const YEAR = new Date().getFullYear();
const APP_NAME = 'Chttrix';
const APP_URL = process.env.FRONTEND_URL || 'https://chttrix.com';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bgOuter:       '#060606',
  bgCard:        '#111111',
  bgHeader:      '#0c0c0c',
  bgSection:     '#0a0a0a',
  bgCodeBlock:   '#0c0c0c',
  accent:        '#b8956a',
  accentLight:   '#d4a97a',
  accentDark:    '#8a6a4a',
  textPrimary:   '#e4e4e4',
  textSecondary: '#9a9a9a',
  textMuted:     '#5a5a5a',
  textDanger:    '#e05252',
  textSuccess:   '#4db88e',
  border:        '#1e1e1e',
  borderAccent:  'rgba(184,149,106,0.3)',
};

// ─── Base Template Shell ──────────────────────────────────────────────────────
/**
 * Wraps body HTML in the Chttrix branded shell.
 * @param {Object} opts
 * @param {string} opts.icon       — emoji or text (36px, no background needed)
 * @param {string} opts.title      — H1 headline
 * @param {string} opts.subtitle   — muted subtitle under headline
 * @param {string} opts.body       — inner HTML content (rows, buttons, paragraphs)
 * @param {string} [opts.preheader] — hidden preview text in email clients
 */
function _shell({ icon, title, subtitle, body, preheader = '' }) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${title}</title>
  <style>
    @media only screen and (max-width:600px) {
      .email-card { width:100% !important; }
      .email-pad  { padding:24px 20px !important; }
      .btn-mobile { display:block !important; text-align:center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${T.bgOuter};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,Helvetica,Arial,sans-serif">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:${T.bgOuter};line-height:1px">${preheader || title} &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.bgOuter}">
    <tr>
      <td align="center" style="padding:40px 16px 60px">

        <!-- Card -->
        <table class="email-card" role="presentation" width="580" cellpadding="0" cellspacing="0" border="0"
          style="max-width:580px;width:100%;background-color:${T.bgCard};border:1px solid ${T.border}">

          <!-- ── Logo Header ── -->
          <tr>
            <td bgcolor="${T.bgHeader}" style="padding:20px 32px;border-bottom:1px solid ${T.border}">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:16px;font-weight:800;color:${T.textPrimary};letter-spacing:-0.03em;font-family:inherit">${APP_NAME}</span>
                    <span style="font-size:11px;font-weight:600;color:${T.accent};letter-spacing:0.18em;text-transform:uppercase;margin-left:10px;font-family:inherit">AI Collaboration</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Amber Accent Stripe ── -->
          <tr>
            <td height="2" bgcolor="${T.accent}" style="font-size:0;line-height:0">&nbsp;</td>
          </tr>

          <!-- ── Hero: Icon + Title ── -->
          <tr>
            <td class="email-pad" style="padding:40px 32px 24px;border-bottom:1px solid ${T.border}">
              <p style="margin:0 0 14px;font-size:40px;line-height:1">${icon}</p>
              <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:${T.textPrimary};letter-spacing:-0.02em;line-height:1.3;font-family:inherit">${title}</h1>
              <p style="margin:0;font-size:14px;color:${T.textSecondary};line-height:1.6;font-family:inherit">${subtitle}</p>
            </td>
          </tr>

          <!-- ── Body Content ── -->
          <tr>
            <td class="email-pad" style="padding:32px">
              ${body}
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td bgcolor="${T.bgHeader}" style="padding:20px 32px;border-top:1px solid ${T.border}">
              <p style="margin:0 0 4px;font-size:12px;color:${T.textMuted};line-height:1.5;font-family:inherit">This is an automated message from ${APP_NAME}. Please do not reply to this email.</p>
              <p style="margin:0;font-size:12px;color:#3a3a3a;font-family:inherit">&copy; ${YEAR} ${APP_NAME} Inc. All rights reserved.</p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─── Reusable Partials ────────────────────────────────────────────────────────

/** Big amber CTA button */
function _btn(text, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0">
  <tr>
    <td style="background-color:${T.accent};padding:14px 32px">
      <a href="${url}" style="font-size:14px;font-weight:700;color:#000000;text-decoration:none;font-family:inherit;letter-spacing:0.03em;white-space:nowrap">${text} &rarr;</a>
    </td>
  </tr>
</table>`;
}

/** Ghost secondary link (smaller, amber text) */
function _link(text, url) {
  return `<p style="margin:0;font-size:13px;color:${T.textMuted};line-height:1.6;word-break:break-all;font-family:inherit">
  Or copy this link: <a href="${url}" style="color:${T.accent};text-decoration:none;font-family:inherit">${url}</a>
</p>`;
}

/** Info row inside a dark data card */
function _row(label, value, highlight) {
  return `<tr>
  <td style="padding:10px 0;border-bottom:1px solid ${T.border};font-size:13px;color:${T.textSecondary};width:120px;font-family:inherit;vertical-align:top">${label}</td>
  <td style="padding:10px 0;border-bottom:1px solid ${T.border};font-size:13px;color:${highlight ? T.accent : T.textPrimary};font-weight:${highlight ? '700' : '500'};font-family:${highlight ? 'monospace,Courier,monospace' : 'inherit'};letter-spacing:${highlight ? '0.08em' : '0'}">${value}</td>
</tr>`;
}

/** Dark info card wrapper (wraps _row() calls) */
function _card(content) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:${T.bgSection};border:1px solid ${T.border};margin:20px 0">
  <tr>
    <td style="padding:16px 20px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${content}</table>
    </td>
  </tr>
</table>`;
}

/** Warning / security alert box */
function _alert(text, kind) {
  const colors = {
    warning: { bg: 'rgba(255,190,50,0.07)', border: '#b8860b', text: '#f0c040' },
    danger:  { bg: 'rgba(224,82,82,0.07)',  border: '#993333', text: T.textDanger },
    info:    { bg: 'rgba(184,149,106,0.07)', border: T.accentDark, text: T.accent },
    success: { bg: 'rgba(77,184,142,0.07)', border: '#2d7d5c', text: T.textSuccess },
  };
  const c = colors[kind] || colors.info;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:${c.bg};border-left:3px solid ${c.border};margin:24px 0">
  <tr>
    <td style="padding:16px 20px;font-size:13px;color:${c.text};line-height:1.6;font-family:inherit">${text}</td>
  </tr>
</table>`;
}

/** OTP / code display block */
function _otp(code) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto">
  <tr>
    <td align="center" bgcolor="${T.bgCodeBlock}"
      style="padding:20px 40px;border:1px solid ${T.borderAccent}">
      <span style="font-size:36px;font-weight:800;letter-spacing:0.25em;color:${T.accent};font-family:'Courier New',Courier,monospace">${code}</span>
    </td>
  </tr>
</table>`;
}

/** Simple paragraph */
function _p(text, opts = {}) {
  const size = opts.size || '14px';
  const color = opts.color || T.textSecondary;
  const mt = opts.mt || '0';
  const mb = opts.mb || '16px';
  return `<p style="margin:${mt} 0 ${mb};font-size:${size};color:${color};line-height:1.7;font-family:inherit">${text}</p>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  TEMPLATE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. Email Verification (signup link) ───────────────────────────────────────
/**
 * @param {string} username
 * @param {string} verifyUrl
 */
function verifyEmailTemplate(username, verifyUrl) {
  const body = `
    ${_p(`Hi <strong style="color:${T.textPrimary}">${username}</strong>,`)}
    ${_p('Welcome to Chttrix! Please verify your email address to activate your account and start collaborating with your team.', { mb: '0' })}
    ${_btn('Verify Email Address', verifyUrl)}
    ${_link('Verify your email', verifyUrl)}
    ${_p('This verification link expires in <strong style="color:${T.textPrimary}">24 hours</strong>. If you did not create a Chttrix account, you can safely ignore this email.', { size: '13px', color: T.textMuted, mt: '24px', mb: '0' })}
  `;
  return {
    subject: `Verify your Chttrix email address`,
    text: `Hi ${username}, verify your Chttrix email: ${verifyUrl}`,
    html: _shell({
      icon: '✉️',
      title: 'Verify Your Email',
      subtitle: 'One click to activate your Chttrix account.',
      preheader: `Hi ${username}, please verify your email to get started on Chttrix.`,
      body,
    }),
  };
}

// ── 2. Password Reset ─────────────────────────────────────────────────────────
/**
 * @param {string} username
 * @param {string} resetUrl
 */
function passwordResetTemplate(username, resetUrl) {
  const body = `
    ${_p(`Hi <strong style="color:${T.textPrimary}">${username}</strong>,`)}
    ${_p('We received a request to reset your Chttrix account password. Click the button below to choose a new password.')}
    ${_btn('Reset Password', resetUrl)}
    ${_link('Reset your password', resetUrl)}
    ${_alert('<strong>Security note:</strong> This link expires in <strong>1 hour</strong>. If you did not request a password reset, please ignore this email — your account remains secure.', 'warning')}
  `;
  return {
    subject: `Reset your Chttrix password`,
    text: `Hi ${username}, reset your password here: ${resetUrl} (expires in 1 hour)`,
    html: _shell({
      icon: '🔑',
      title: 'Reset Your Password',
      subtitle: 'A password reset was requested for your account.',
      preheader: `Hi ${username}, reset your Chttrix password using the link inside.`,
      body,
    }),
  };
}

// ── 3. Password Set (OAuth users adding password login) ───────────────────────
/**
 * @param {string} username
 * @param {string} provider  e.g. 'google'
 */
function passwordSetTemplate(username, provider) {
  const providerLabel = provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'OAuth';
  const body = `
    ${_p(`Hi <strong style="color:${T.textPrimary}">${username}</strong>,`)}
    ${_p(`You've successfully added password login to your Chttrix account. You can now sign in with either your <strong style="color:${T.textPrimary}">${providerLabel}</strong> account or your email and password.`)}
    ${_alert('If you did not set a password on your account, your account may have been accessed without authorization. Please change your password immediately and contact support.', 'danger')}
    ${_btn('Go to Chttrix', APP_URL)}
  `;
  return {
    subject: `Password login enabled on your Chttrix account`,
    text: `Hi ${username}, password login has been enabled on your Chttrix account.`,
    html: _shell({
      icon: '🔐',
      title: 'Password Login Enabled',
      subtitle: `Password login was added to your ${providerLabel} account.`,
      preheader: `Password login is now enabled on your Chttrix account, ${username}.`,
      body,
    }),
  };
}

// ── 4. Account Reactivation (OTP for deactivated accounts) ───────────────────
/**
 * @param {string} username
 * @param {string} otpCode
 */
function reactivateAccountTemplate(username, otpCode) {
  const body = `
    ${_p(`Hi <strong style="color:${T.textPrimary}">${username}</strong>,`)}
    ${_p('A sign-in attempt was made on your deactivated Chttrix account. Use the verification code below to reactivate it:')}
    ${_otp(otpCode)}
    ${_p('This code expires in <strong style="color:${T.textPrimary}">10 minutes</strong>. After entering this code you\'ll complete reactivation with your password.', { size: '13px', color: T.textMuted, mb: '0' })}
    ${_alert('If you did not attempt to log in, someone else may have your credentials. Your account remains deactivated — no action is needed unless you want to reactivate it.', 'warning')}
  `;
  return {
    subject: `Reactivate your Chttrix account`,
    text: `Hi ${username}, your Chttrix reactivation code is: ${otpCode} (expires in 10 minutes)`,
    html: _shell({
      icon: '🔓',
      title: 'Reactivate Your Account',
      subtitle: 'Enter this code to restore access to your Chttrix account.',
      preheader: `Your Chttrix reactivation code is ${otpCode}.`,
      body,
    }),
  };
}

// ── 5. Email Verification Code (OTP for adding secondary email) ───────────────
/**
 * @param {string} username
 * @param {string} code      — 6-digit OTP
 */
function emailVerificationTemplate(username, code) {
  const body = `
    ${_p(`Hi <strong style="color:${T.textPrimary}">${username}</strong>,`)}
    ${_p('Use the verification code below to confirm your new email address on Chttrix:')}
    ${_otp(code)}
    ${_p('This code expires in <strong style="color:${T.textPrimary}">15 minutes</strong>. If you didn\'t request this, you can safely ignore this email.', { size: '13px', color: T.textMuted, mb: '0' })}
  `;
  return {
    subject: `Your Chttrix verification code`,
    text: `Hi ${username}, your Chttrix email verification code is: ${code} (expires in 15 minutes)`,
    html: _shell({
      icon: '✉️',
      title: 'Email Verification Code',
      subtitle: 'Enter this code in Chttrix to verify your email address.',
      preheader: `Your Chttrix verification code is ${code}.`,
      body,
    }),
  };
}

// ── 6. Company / Team Invite (magic link) ────────────────────────────────────
/**
 * @param {string} name
 * @param {string} companyName
 * @param {string} inviteLink
 * @param {Object} [opts]
 * @param {string} [opts.jobTitle]
 * @param {boolean} [opts.isResend]
 */
function inviteTemplate(name, companyName, inviteLink, opts = {}) {
  const { jobTitle = '', isResend = false } = opts;
  const greeting = name ? `Hi <strong style="color:${T.textPrimary}">${name}</strong>,` : `You've been invited to Chttrix.`;
  const roleRow = jobTitle ? _card(_row('Your role', jobTitle)) : '';
  const badge = isResend ? `<span style="font-size:11px;font-weight:700;color:${T.accent};letter-spacing:0.1em;text-transform:uppercase;margin-left:8px">(Resent)</span>` : '';
  const body = `
    ${_p(greeting)}
    ${_p(`You've been invited to join <strong style="color:${T.textPrimary}">${companyName}</strong> on Chttrix — the AI-augmented collaboration platform.${badge}`)}
    ${roleRow}
    ${_btn('Accept Invitation & Set Password', inviteLink)}
    ${_link('Accept invitation', inviteLink)}
    ${_p('This invitation expires in <strong style="color:${T.textPrimary}">72 hours</strong>. If you didn\'t expect this email, you can safely ignore it.', { size: '13px', color: T.textMuted, mt: '20px', mb: '0' })}
  `;
  return {
    subject: `You're invited to join ${companyName} on Chttrix`,
    text: `Hi ${name}, you've been invited to join ${companyName} on Chttrix. Accept here: ${inviteLink}`,
    html: _shell({
      icon: '👋',
      title: `Join ${companyName} on Chttrix`,
      subtitle: `You've been invited to collaborate with ${companyName}.`,
      preheader: `${name || 'You'} — accept your invitation to join ${companyName} on Chttrix.`,
      body,
    }),
  };
}

// ── 7. Bulk Import Welcome + Credentials ─────────────────────────────────────
/**
 * @param {string} name
 * @param {string} workEmail
 * @param {string} tempPassword
 * @param {string} companyName
 */
function bulkWelcomeTemplate(name, workEmail, tempPassword, companyName) {
  const loginUrl = `${APP_URL}/login`;
  const body = `
    ${_p(`Hi <strong style="color:${T.textPrimary}">${name}</strong>,`)}
    ${_p(`Your Chttrix account for <strong style="color:${T.textPrimary}">${companyName}</strong> has been created. Use the credentials below to sign in:`)}
    ${_card(
      _row('Work Email', workEmail) +
      _row('Temporary Password', tempPassword, true)
    )}
    ${_btn('Log In to Chttrix', loginUrl)}
    ${_alert('<strong>Important:</strong> Please change your password immediately after your first login. Your temporary password will be flagged until you set a permanent one.', 'warning')}
    ${_p('If you didn\'t expect this email, please contact your company administrator.', { size: '13px', color: T.textMuted, mb: '0' })}
  `;
  return {
    subject: `Your Chttrix login credentials — ${companyName}`,
    text: `Hi ${name}, your Chttrix credentials for ${companyName}: Email: ${workEmail} | Password: ${tempPassword} | Login: ${loginUrl}`,
    html: _shell({
      icon: '🎉',
      title: `Welcome to ${companyName}`,
      subtitle: 'Your Chttrix account is ready. Sign in below.',
      preheader: `${name}, your Chttrix account for ${companyName} is active. Here are your credentials.`,
      body,
    }),
  };
}

// ── 8. Workspace Invite ───────────────────────────────────────────────────────
/**
 * @param {string} name
 * @param {string} workspaceName
 * @param {string} inviteLink
 */
function workspaceInviteTemplate(name, workspaceName, inviteLink) {
  const greeting = name ? `Hi <strong style="color:${T.textPrimary}">${name}</strong>,` : 'You\'ve been invited!';
  const body = `
    ${_p(greeting)}
    ${_p(`You've been invited to join the workspace <strong style="color:${T.textPrimary}">${workspaceName}</strong> on Chttrix.`)}
    ${_btn('Join Workspace', inviteLink)}
    ${_link('Join workspace', inviteLink)}
    ${_p('If you didn\'t expect this email, you can safely ignore it.', { size: '13px', color: T.textMuted, mt: '20px', mb: '0' })}
  `;
  return {
    subject: `You're invited to join "${workspaceName}" on Chttrix`,
    text: `Hi ${name}, you've been invited to join ${workspaceName} on Chttrix. Join here: ${inviteLink}`,
    html: _shell({
      icon: '💬',
      title: `Join ${workspaceName}`,
      subtitle: 'A workspace invitation is waiting for you on Chttrix.',
      preheader: `You've been invited to join the ${workspaceName} workspace on Chttrix.`,
      body,
    }),
  };
}

// ── 9. Workspace Invite Reminder ──────────────────────────────────────────────
/**
 * @param {string} name
 * @param {string} workspaceName
 * @param {string} inviteLink
 */
function workspaceInviteReminderTemplate(name, workspaceName, inviteLink) {
  const greeting = name ? `Hi <strong style="color:${T.textPrimary}">${name}</strong>,` : 'Just a reminder!';
  const body = `
    ${_p(greeting)}
    ${_p(`This is a reminder that you have a pending invitation to join <strong style="color:${T.textPrimary}">${workspaceName}</strong> on Chttrix. Your team is waiting!`)}
    ${_btn('Accept Invitation', inviteLink)}
    ${_link('Accept invitation', inviteLink)}
    ${_p('If you\'ve already joined or don\'t wish to join, you can ignore this message.', { size: '13px', color: T.textMuted, mt: '20px', mb: '0' })}
  `;
  return {
    subject: `Reminder: Join ${workspaceName} on Chttrix`,
    text: `Hi ${name}, reminder: join ${workspaceName} on Chttrix here: ${inviteLink}`,
    html: _shell({
      icon: '🔔',
      title: 'Workspace Invite Reminder',
      subtitle: `Your invitation to join ${workspaceName} is still pending.`,
      preheader: `Reminder: you have a pending invitation to join ${workspaceName} on Chttrix.`,
      body,
    }),
  };
}

// ── 10. Task Assigned ────────────────────────────────────────────────────────
/**
 * @param {string} name
 * @param {string} taskTitle
 * @param {string} assignedBy
 * @param {string} [taskUrl]
 */
function taskAssignedTemplate(name, taskTitle, assignedBy, taskUrl) {
  const url = taskUrl || APP_URL;
  const greeting = name ? `Hi <strong style="color:${T.textPrimary}">${name}</strong>,` : 'Hi there,';
  const body = `
    ${_p(greeting)}
    ${_p(`<strong style="color:${T.textPrimary}">${assignedBy}</strong> has assigned you a new task on Chttrix:`)}
    ${_card(_row('Task', `<strong style="color:${T.textPrimary}">${taskTitle}</strong>`) + _row('Assigned By', assignedBy))}
    ${_btn('View Task', url)}
  `;
  return {
    subject: `New task assigned: ${taskTitle}`,
    text: `Hi ${name}, ${assignedBy} assigned you a task: "${taskTitle}". View it here: ${url}`,
    html: _shell({
      icon: '✅',
      title: 'New Task Assigned',
      subtitle: `${assignedBy} has assigned you a task.`,
      preheader: `${assignedBy} assigned you "${taskTitle}" on Chttrix.`,
      body,
    }),
  };
}

// ── 11. Meeting Scheduled ────────────────────────────────────────────────────
/**
 * @param {string} name
 * @param {string} meetingTitle
 * @param {string} [formattedTime]
 * @param {string} [meetingUrl]
 */
function meetingScheduledTemplate(name, meetingTitle, formattedTime, meetingUrl) {
  const url = meetingUrl || `${APP_URL}/huddles`;
  const greeting = name ? `Hi <strong style="color:${T.textPrimary}">${name}</strong>,` : 'Hi there,';
  const timeRow = formattedTime ? _row('Time', formattedTime) : '';
  const body = `
    ${_p(greeting)}
    ${_p('A new meeting has been scheduled on Chttrix. You\'re invited to attend:')}
    ${_card(_row('Meeting', `<strong style="color:${T.textPrimary}">${meetingTitle}</strong>`) + timeRow)}
    ${_btn('View Meeting', url)}
  `;
  return {
    subject: `Meeting scheduled: ${meetingTitle}`,
    text: `Hi ${name}, a meeting has been scheduled: "${meetingTitle}"${formattedTime ? ` at ${formattedTime}` : ''}. View: ${url}`,
    html: _shell({
      icon: '📅',
      title: 'Meeting Scheduled',
      subtitle: 'You have a new meeting invitation on Chttrix.',
      preheader: `New meeting: ${meetingTitle}${formattedTime ? ` — ${formattedTime}` : ''}.`,
      body,
    }),
  };
}

// ── 12. Security — New Device Sign-In ────────────────────────────────────────
/**
 * @param {string} name
 * @param {string} deviceName
 * @param {string} platform
 * @param {string} location     e.g. "from IP 1.2.3.4"
 * @param {string} formattedTime
 */
function newDeviceSignInTemplate(name, deviceName, platform, location, formattedTime) {
  const securityUrl = `${APP_URL}/settings/security`;
  const greeting = name ? `Hi <strong style="color:${T.textPrimary}">${name}</strong>,` : 'Hi there,';
  const locationRow = location ? _row('Location', location) : '';
  const body = `
    ${_p(greeting)}
    ${_p('A new device was used to sign in to your Chttrix account:')}
    ${_card(
      _row('Device', deviceName) +
      _row('Platform', platform) +
      locationRow +
      _row('Time', formattedTime)
    )}
    ${_alert('<strong>If this was you</strong>, no action is needed.<br><br><strong>If this wasn\'t you</strong>, secure your account immediately — change your password and revoke unknown sessions in Security Settings.', 'warning')}
    ${_btn('Review Security Settings', securityUrl)}
  `;
  return {
    subject: `New device signed in to your Chttrix account`,
    text: `Hi ${name}, a new device (${deviceName}, ${platform}) signed in to your Chttrix account at ${formattedTime}. If this wasn't you, visit ${securityUrl}.`,
    html: _shell({
      icon: '🔒',
      title: 'New Device Sign-In',
      subtitle: 'We detected a sign-in from a new device on your account.',
      preheader: `New sign-in detected on your Chttrix account from ${deviceName}.`,
      body,
    }),
  };
}

// ── 13. Security — Password Changed ──────────────────────────────────────────
/**
 * @param {string} name
 * @param {string} deviceName
 * @param {string} formattedTime
 */
function passwordChangedTemplate(name, deviceName, formattedTime) {
  const resetUrl = `${APP_URL}/forgot-password`;
  const greeting = name ? `Hi <strong style="color:${T.textPrimary}">${name}</strong>,` : 'Hi there,';
  const body = `
    ${_p(greeting)}
    ${_p('Your Chttrix account password was successfully changed.')}
    ${_card(
      _row('Device', deviceName) +
      _row('Time', formattedTime)
    )}
    ${_alert('<strong>If this was you</strong>, no action is needed — you\'re all set.<br><br><strong>If this wasn\'t you</strong>, your account may be compromised. Reset your password immediately and contact support.', 'danger')}
    ${_btn('Reset Password (if needed)', resetUrl)}
  `;
  return {
    subject: `Your Chttrix password was changed`,
    text: `Hi ${name}, your Chttrix password was changed at ${formattedTime} from ${deviceName}. If this wasn't you, reset your password at ${resetUrl}.`,
    html: _shell({
      icon: '🔐',
      title: 'Password Changed',
      subtitle: 'Your Chttrix account password has been updated.',
      preheader: `Your Chttrix password was changed at ${formattedTime}.`,
      body,
    }),
  };
}

// ── 14. Security — All Devices Revoked ───────────────────────────────────────
/**
 * @param {string} name
 * @param {number} revokedCount
 * @param {string} deviceName   — device that initiated the sign-out
 * @param {string} formattedTime
 */
function allDevicesRevokedTemplate(name, revokedCount, deviceName, formattedTime) {
  const securityUrl = `${APP_URL}/settings/security`;
  const greeting = name ? `Hi <strong style="color:${T.textPrimary}">${name}</strong>,` : 'Hi there,';
  const countLabel = revokedCount === 1 ? '1 device' : `${revokedCount} devices`;
  const body = `
    ${_p(greeting)}
    ${_p(`All other sessions (${countLabel}) have been signed out of your Chttrix account.`)}
    ${_card(
      _row('Initiated from', deviceName) +
      _row('Sessions revoked', String(revokedCount)) +
      _row('Time', formattedTime)
    )}
    ${_alert('<strong>If this was you</strong>, all other devices are now signed out — you\'re secure.<br><br><strong>If this wasn\'t you</strong>, change your password immediately and review your security settings.', 'info')}
    ${_btn('Review Security Settings', securityUrl)}
  `;
  return {
    subject: `All other devices signed out of your Chttrix account`,
    text: `Hi ${name}, all other devices (${countLabel}) were signed out of your Chttrix account at ${formattedTime}. Review at ${securityUrl}.`,
    html: _shell({
      icon: '🚪',
      title: 'All Devices Signed Out',
      subtitle: 'All other active sessions have been terminated for your account.',
      preheader: `${countLabel} signed out of your Chttrix account at ${formattedTime}.`,
      body,
    }),
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  // Auth
  verifyEmailTemplate,
  passwordResetTemplate,
  passwordSetTemplate,
  reactivateAccountTemplate,
  emailVerificationTemplate,
  // Onboarding
  inviteTemplate,
  bulkWelcomeTemplate,
  // Workspaces
  workspaceInviteTemplate,
  workspaceInviteReminderTemplate,
  // Notifications
  taskAssignedTemplate,
  meetingScheduledTemplate,
  // Security
  newDeviceSignInTemplate,
  passwordChangedTemplate,
  allDevicesRevokedTemplate,
};
