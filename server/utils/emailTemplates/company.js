// server/utils/emailTemplates/company.js
// Company and employee management email templates — Chttrix dark theme

const YEAR = new Date().getFullYear();
const APP  = 'Chttrix';
const APP_URL = process.env.FRONTEND_URL || 'https://chttrix.com';

const T = {
  bgOuter:     '#060606',
  bgCard:      '#111111',
  bgHeader:    '#0c0c0c',
  bgSection:   '#0a0a0a',
  accent:      '#b8956a',
  accentDark:  '#8a6a4a',
  textPrimary: '#e4e4e4',
  textSub:     '#9a9a9a',
  textMuted:   '#5a5a5a',
  textDanger:  '#e05252',
  textSuccess: '#4db88e',
  border:      '#1e1e1e',
  borderAccent:'rgba(184,149,106,0.35)',
};

function shell({ icon, title, subtitle, body, preheader = '' }) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${title}</title>
  <style>@media only screen and (max-width:600px){.ec{width:100%!important;}.ep{padding:24px 18px!important;}}</style>
</head>
<body style="margin:0;padding:0;background-color:${T.bgOuter};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,Helvetica,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:${T.bgOuter};line-height:1px">${preheader || title}&zwnj;&nbsp;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.bgOuter}">
    <tr><td align="center" style="padding:40px 16px 60px">
      <table class="ec" role="presentation" width="580" cellpadding="0" cellspacing="0" border="0"
        style="max-width:580px;width:100%;background-color:${T.bgCard};border:1px solid ${T.border}">

        <!-- Logo -->
        <tr>
          <td bgcolor="${T.bgHeader}" style="padding:18px 32px;border-bottom:1px solid ${T.border}">
            <span style="font-size:17px;font-weight:800;color:${T.textPrimary};letter-spacing:-0.03em">${APP}</span>
            <span style="font-size:10px;font-weight:600;color:${T.accent};letter-spacing:0.2em;text-transform:uppercase;margin-left:10px">AI Collaboration</span>
          </td>
        </tr>

        <!-- Gold stripe -->
        <tr><td height="2" bgcolor="${T.accent}" style="font-size:0;line-height:0">&nbsp;</td></tr>

        <!-- Hero -->
        <tr>
          <td class="ep" style="padding:40px 32px 24px;border-bottom:1px solid ${T.border}">
            <p style="margin:0 0 12px;font-size:38px;line-height:1">${icon}</p>
            <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:${T.textPrimary};letter-spacing:-0.02em;line-height:1.3">${title}</h1>
            <p style="margin:0;font-size:14px;color:${T.textSub};line-height:1.6">${subtitle}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr><td class="ep" style="padding:32px">${body}</td></tr>

        <!-- Footer -->
        <tr>
          <td bgcolor="${T.bgHeader}" style="padding:18px 32px;border-top:1px solid ${T.border}">
            <p style="margin:0 0 4px;font-size:12px;color:${T.textMuted};line-height:1.5">Automated message from ${APP}. Please do not reply.</p>
            <p style="margin:0;font-size:12px;color:#333">&copy; ${YEAR} ${APP} Inc. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(text, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0">
  <tr><td style="background-color:${T.accent};padding:14px 32px">
    <a href="${url}" style="font-size:14px;font-weight:700;color:#000;text-decoration:none;letter-spacing:0.03em;white-space:nowrap">${text} &rarr;</a>
  </td></tr>
</table>`;
}

function infoCard(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:${T.bgSection};border:1px solid ${T.border};margin:20px 0">
  <tr><td style="padding:16px 20px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
  </td></tr>
</table>`;
}

function row(label, value, highlight = false) {
  return `<tr>
  <td style="padding:10px 0;border-bottom:1px solid ${T.border};font-size:13px;color:${T.textSub};width:140px;vertical-align:top">${label}</td>
  <td style="padding:10px 0;border-bottom:1px solid ${T.border};font-size:13px;color:${highlight ? T.accent : T.textPrimary};font-weight:${highlight ? '700' : '500'};font-family:${highlight ? "'Courier New',Courier,monospace" : 'inherit'}">${value}</td>
</tr>`;
}

function alert(text, kind = 'info') {
  const map = {
    info:    { bg: 'rgba(184,149,106,0.07)', border: T.accentDark, clr: T.accent },
    warning: { bg: 'rgba(255,190,50,0.07)',  border: '#b8860b',    clr: '#f0c040' },
    danger:  { bg: 'rgba(224,82,82,0.07)',   border: '#993333',    clr: T.textDanger },
    success: { bg: 'rgba(77,184,142,0.07)',  border: '#2d7d5c',    clr: T.textSuccess },
  };
  const c = map[kind] || map.info;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:${c.bg};border-left:3px solid ${c.border};margin:20px 0">
  <tr><td style="padding:14px 18px;font-size:13px;color:${c.clr};line-height:1.6">${text}</td></tr>
</table>`;
}

function p(text, { size = '14px', color = T.textSub, mt = '0', mb = '16px' } = {}) {
  return `<p style="margin:${mt} 0 ${mb};font-size:${size};color:${color};line-height:1.7">${text}</p>`;
}

function link(text, url) {
  return `<p style="margin:0;font-size:13px;color:${T.textMuted};word-break:break-all">
  Or copy: <a href="${url}" style="color:${T.accent};text-decoration:none">${url}</a>
</p>`;
}

// ─── Company Approved ─────────────────────────────────────────────────────────
const companyApprovedTemplate = (username, companyName, loginUrl, customMessage) => {
  const msgBlock = customMessage
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background-color:${T.bgSection};border-left:3px solid ${T.accent};margin:16px 0">
        <tr><td style="padding:14px 18px;font-size:14px;color:${T.textSub};font-style:italic;line-height:1.6">"${customMessage}"</td></tr>
      </table>`
    : '';

  const body = `
    ${p(`Hi <strong style="color:${T.textPrimary}">${username}</strong>,`)}
    ${p(`Great news! We've verified <strong style="color:${T.textPrimary}">${companyName}</strong>. Your workspace has been provisioned and is ready for your team.`)}
    ${msgBlock}
    ${alert('<strong>What\'s unlocked:</strong> Full access to channels, huddles, task management, and AI-powered collaboration tools.', 'success')}
    ${btn('Go to Workspace', loginUrl)}
    ${link('Go to workspace', loginUrl)}
  `;

  return {
    subject: `🎉 You're In! ${companyName} is Verified — Chttrix`,
    html: shell({
      icon: '🚀',
      title: "You're Ready to Launch",
      subtitle: `${companyName} has been approved. Let's build something great.`,
      preheader: `${username}, your Chttrix workspace for ${companyName} is live and ready.`,
      body,
    }),
    text: `Hi ${username},\n\nGreat news! ${companyName} has been verified on Chttrix.\n\nGo to your workspace: ${loginUrl}\n\n— The Chttrix Team`,
  };
};

// ─── Company Rejected ─────────────────────────────────────────────────────────
const companyRejectedTemplate = (username, companyName, reason, customMessage) => {
  const reasonText = customMessage || reason || 'Application criteria not met.';
  const body = `
    ${p(`Dear <strong style="color:${T.textPrimary}">${username}</strong>,`)}
    ${p(`Thank you for your interest in Chttrix. We've reviewed your application for <strong style="color:${T.textPrimary}">${companyName}</strong>.`)}
    ${p('Unfortunately, we are unable to proceed with your verification at this time.')}
    ${alert(`<strong>Reason:</strong> ${reasonText}`, 'danger')}
    ${p('If you believe this decision was made in error, please reply to this email or contact our support team.', { size: '13px', color: T.textMuted, mb: '0' })}
  `;

  return {
    subject: `Update on your Chttrix Application — ${companyName}`,
    html: shell({
      icon: '📋',
      title: 'Application Update',
      subtitle: `Regarding your Chttrix verification request for ${companyName}.`,
      preheader: `${username}, we have an update on your Chttrix application for ${companyName}.`,
      body,
    }),
    text: `Dear ${username},\n\nYour application for ${companyName} on Chttrix could not be approved.\n\nReason: ${reasonText}\n\nPlease contact support if you believe this is in error.\n\n— The Chttrix Team`,
  };
};

// ─── Employee Credentials ─────────────────────────────────────────────────────
const employeeCredentialsTemplate = (fullName, companyName, companyEmail, temporaryPassword, loginUrl) => {
  const body = `
    ${p(`Hello <strong style="color:${T.textPrimary}">${fullName}</strong>,`)}
    ${p(`Your administrator has created a Chttrix account for you at <strong style="color:${T.textPrimary}">${companyName}</strong>. Here are your login credentials:`)}
    ${infoCard(
      row('Company Email', companyEmail) +
      row('Temporary Password', temporaryPassword, true)
    )}
    ${alert('<strong>Important:</strong> You will be prompted to change your password on first login. Choose a strong, unique password.', 'warning')}
    ${btn('Log in to Chttrix', loginUrl)}
    ${link('Log in here', loginUrl)}
    ${p('If you have any questions, please contact your administrator.', { size: '13px', color: T.textMuted, mt: '20px', mb: '0' })}
  `;

  return {
    subject: `Welcome to ${companyName} — Your Chttrix Account`,
    html: shell({
      icon: '👋',
      title: `Welcome to ${companyName}`,
      subtitle: 'Your Chttrix account is ready. Sign in to start collaborating.',
      preheader: `${fullName}, your Chttrix workspace account for ${companyName} is ready.`,
      body,
    }),
    text: `Hello ${fullName},\n\nYour Chttrix account for ${companyName} has been created.\n\nEmail: ${companyEmail}\nPassword: ${temporaryPassword}\n\nLogin: ${loginUrl}\n\nPlease change your password after first login.\n\n— The Chttrix Team`,
  };
};

module.exports = {
  companyApprovedTemplate,
  companyRejectedTemplate,
  employeeCredentialsTemplate,
};
