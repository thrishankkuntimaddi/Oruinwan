// server/utils/emailTemplates/workspace.js
// Workspace collaboration email templates — Chttrix dark theme

const YEAR = new Date().getFullYear();
const APP  = 'Chttrix';

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
  border:      '#e8e2da',
  borderAccent:'rgba(184,149,106,0.35)',
};

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
            <p style="margin:0 0 4px;font-size:12px;color:${T.textMuted};line-height:1.5">Automated message from ${APP}. Please do not reply.</p>
            <p style="margin:0;font-size:12px;color:#888888">&copy; ${YEAR} ${APP} Inc. All rights reserved.</p>
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

function row(label, value) {
  return `<tr>
  <td style="padding:10px 0;border-bottom:1px solid ${T.border};font-size:13px;color:${T.textSub};width:140px;vertical-align:top">${label}</td>
  <td style="padding:10px 0;border-bottom:1px solid ${T.border};font-size:13px;color:${T.textPrimary};font-weight:500">${value}</td>
</tr>`;
}

function p(text, { size = '14px', color = T.textSub, mt = '0', mb = '16px' } = {}) {
  return `<p style="margin:${mt} 0 ${mb};font-size:${size};color:${color};line-height:1.7">${text}</p>`;
}

function link(text, url) {
  return `<p style="margin:0;font-size:13px;color:${T.textMuted};word-break:break-all">
  Or copy: <a href="${url}" style="color:${T.accent};text-decoration:none">${url}</a>
</p>`;
}

// ─── Workspace Invitation ─────────────────────────────────────────────────────
const workspaceInvitationTemplate = (workspaceName, inviterName, inviteUrl, role, expiryDays) => {
  const body = `
    ${p('You\'ve been invited to collaborate on Chttrix!')}
    ${infoCard(
      row('Workspace', `<strong style="color:${T.textPrimary}">${workspaceName}</strong>`) +
      row('Invited by', inviterName) +
      row('Your role', `<span style="color:${T.accent};font-weight:600">${role || 'Member'}</span>`)
    )}
    ${p('Join this workspace to start collaborating with your team through channels, direct messages, tasks, and shared resources.')}
    ${btn('Join Workspace', inviteUrl)}
    ${link('Join workspace', inviteUrl)}
    ${p(`This invitation expires in <strong style="color:${T.textPrimary}">${expiryDays || 7} days</strong> and can only be used once.`, { size: '13px', color: T.textMuted, mt: '20px', mb: '0' })}
  `;

  return {
    subject: `You're invited to join "${workspaceName}" on Chttrix`,
    html: shell({
      icon: '💬',
      title: `Join ${workspaceName}`,
      subtitle: `${inviterName} has invited you to collaborate on Chttrix.`,
      preheader: `${inviterName} invited you to join ${workspaceName} on Chttrix.`,
      body,
    }),
    text: `You've been invited to join ${workspaceName} on Chttrix!\n\nInvited by: ${inviterName}\nRole: ${role || 'Member'}\n\nJoin here: ${inviteUrl}\n\nThis link expires in ${expiryDays || 7} days.\n\n— The Chttrix Team`,
  };
};

module.exports = {
  workspaceInvitationTemplate,
};
