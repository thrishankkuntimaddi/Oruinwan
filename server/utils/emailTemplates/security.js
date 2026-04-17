// server/utils/emailTemplates/security.js
// Security notification email templates — Chttrix dark theme

const YEAR = new Date().getFullYear();
const APP  = 'Chttrix';

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
  border:      '#1e1e1e',
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

        <tr>
          <td bgcolor="${T.bgHeader}" style="padding:18px 32px;border-bottom:1px solid ${T.border}">
            <span style="font-size:17px;font-weight:800;color:${T.textPrimary};letter-spacing:-0.03em">${APP}</span>
            <span style="font-size:10px;font-weight:600;color:${T.accent};letter-spacing:0.2em;text-transform:uppercase;margin-left:10px">AI Collaboration</span>
          </td>
        </tr>
        <tr><td height="2" bgcolor="${T.accent}" style="font-size:0;line-height:0">&nbsp;</td></tr>
        <tr>
          <td class="ep" style="padding:40px 32px 24px;border-bottom:1px solid ${T.border}">
            <p style="margin:0 0 12px;font-size:38px;line-height:1">${icon}</p>
            <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:${T.textPrimary};letter-spacing:-0.02em;line-height:1.3">${title}</h1>
            <p style="margin:0;font-size:14px;color:${T.textSub};line-height:1.6">${subtitle}</p>
          </td>
        </tr>
        <tr><td class="ep" style="padding:32px">${body}</td></tr>
        <tr>
          <td bgcolor="${T.bgHeader}" style="padding:18px 32px;border-top:1px solid ${T.border}">
            <p style="margin:0 0 4px;font-size:12px;color:${T.textMuted}">Automated security notification from ${APP}. Please do not reply.</p>
            <p style="margin:0;font-size:12px;color:#333">&copy; ${YEAR} ${APP} Inc. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(text, url, danger = false) {
  const bg = danger ? T.textDanger : T.accent;
  const clr = danger ? '#fff' : '#000';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0">
  <tr><td style="background-color:${bg};padding:13px 28px">
    <a href="${url}" style="font-size:14px;font-weight:700;color:${clr};text-decoration:none;letter-spacing:0.03em;white-space:nowrap">${text} &rarr;</a>
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

function row(label, value) {
  return `<tr>
  <td style="padding:10px 0;border-bottom:1px solid ${T.border};font-size:13px;color:${T.textSub};width:140px;vertical-align:top">${label}</td>
  <td style="padding:10px 0;border-bottom:1px solid ${T.border};font-size:13px;color:${T.textPrimary};font-weight:500;font-family:'Courier New',Courier,monospace">${value}</td>
</tr>`;
}

function alert(text, kind = 'warning') {
  const map = {
    info:    { bg: 'rgba(184,149,106,0.07)', border: T.accentDark, clr: T.accent },
    warning: { bg: 'rgba(255,190,50,0.07)',  border: '#b8860b',    clr: '#f0c040' },
    danger:  { bg: 'rgba(224,82,82,0.07)',   border: '#993333',    clr: T.textDanger },
  };
  const c = map[kind] || map.warning;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:${c.bg};border-left:3px solid ${c.border};margin:20px 0">
  <tr><td style="padding:14px 18px;font-size:13px;color:${c.clr};line-height:1.6">${text}</td></tr>
</table>`;
}

function p(text, { size = '14px', color = T.textSub, mt = '0', mb = '16px' } = {}) {
  return `<p style="margin:${mt} 0 ${mb};font-size:${size};color:${color};line-height:1.7">${text}</p>`;
}

// ─── Login Detection ──────────────────────────────────────────────────────────
const loginDetectionTemplate = (username, ipAddress, deviceInfo, timestamp, loginUrl) => {
  const formattedTime = new Date(timestamp).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });

  const device = (typeof deviceInfo === 'object' ? deviceInfo.formattedString : deviceInfo) || 'Unknown device';

  const body = `
    ${p(`Hi <strong style="color:${T.textPrimary}">${username}</strong>,`)}
    ${p('We detected a new login to your Chttrix account. If this was you, no action is needed.')}
    ${infoCard(
      row('Time', formattedTime) +
      row('Device', device) +
      row('IP Address', ipAddress)
    )}
    ${alert('<strong>Not you?</strong> If you don\'t recognise this login, your account may be compromised. Change your password and review your active sessions immediately.', 'warning')}
    ${btn('Change Password', `${loginUrl}/reset-password`, true)}
    ${btn('Manage Sessions', `${loginUrl}/settings/security`)}
    ${p('Security tips: use a unique password, review active sessions regularly, and never share your credentials.', { size: '13px', color: T.textMuted, mt: '20px', mb: '0' })}
  `;

  return {
    subject: `New login detected on your Chttrix account`,
    html: shell({
      icon: '🔔',
      title: 'New Login Detected',
      subtitle: 'We noticed a sign-in to your account from a new location or device.',
      preheader: `Security alert: a new login was detected on your Chttrix account, ${username}.`,
      body,
    }),
    text: `Hi ${username},\n\nNew login detected on your Chttrix account.\n\nTime: ${formattedTime}\nDevice: ${device}\nIP: ${ipAddress}\n\nNot you? Change your password immediately: ${loginUrl}/reset-password\nManage sessions: ${loginUrl}/settings/security\n\n— The Chttrix Team`,
  };
};

module.exports = {
  loginDetectionTemplate,
};
