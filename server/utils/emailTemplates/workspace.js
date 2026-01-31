// server/utils/emailTemplates/workspace.js
// Workspace collaboration email templates

/**
 * Workspace Invitation Template
 */
const workspaceInvitationTemplate = (workspaceName, inviterName, inviteUrl, role, expiryDays) => {
    return {
        subject: `You're invited to join ${workspaceName} on Chttrix`,
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f5; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 40px; text-align: center; }
          .logo { font-size: 24px; font-weight: 900; letter-spacing: -1px; margin-bottom: 10px; }
          .icon { font-size: 48px; margin-bottom: 10px; }
          .content { padding: 40px; }
          .workspace-card { background: #f9fafb; border: 2px solid #e5e7eb; padding: 25px; margin: 25px 0; border-radius: 12px; text-align: center; }
          .workspace-name { font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 10px; }
          .role-badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
          .button { display: inline-block; padding: 16px 32px; background: #4f46e5; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 20px 0; transition: background 0.3s; }
          .button:hover { background: #4338ca; }
          .inviter-info { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 25px 0; border-radius: 8px; }
          .footer { background: #fafafa; padding: 30px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }
          h1 { margin: 0; font-size: 28px; font-weight: 800; }
          p { color: #4b5563; margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Chttrix</div>
            <div class="icon">🎉</div>
            <h1>You're Invited!</h1>
          </div>
          <div class="content">
            <p>You've been invited to collaborate on Chttrix!</p>
            
            <div class="workspace-card">
              <div class="workspace-name">${workspaceName}</div>
              <span class="role-badge">Role: ${role || 'Member'}</span>
            </div>

            <div class="inviter-info">
              <strong>👤 Invited by:</strong> ${inviterName}
            </div>

            <p>Join this workspace to start collaborating with your team through channels, direct messages, and shared resources.</p>
            
            <center>
              <a href="${inviteUrl}" class="button">Join Workspace →</a>
            </center>
            
            <p style="text-align: center; margin-top: 20px; font-size: 14px; color: #6b7280;">
              Or copy and paste this link: <br/>
              <a href="${inviteUrl}" style="color: #4f46e5; word-break: break-all;">${inviteUrl}</a>
            </p>

            <p style="margin-top: 30px; font-size: 13px; color: #9ca3af; text-align: center;">
              This invitation link expires in ${expiryDays || 7} days and can only be used once.
            </p>
          </div>
          <div class="footer">
            <p><strong>What is Chttrix?</strong></p>
            <p>Chttrix is a modern collaboration platform that brings teams together with powerful communication tools.</p>
            <p style="margin-top: 20px;">This is an automated message. Please do not reply to this email.</p>
            © ${new Date().getFullYear()} Chttrix Inc. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `,
        text: `
You've been invited to join ${workspaceName} on Chttrix!

Invited by: ${inviterName}
Role: ${role || 'Member'}

Join here: ${inviteUrl}

This invitation link expires in ${expiryDays || 7} days and can only be used once.

Best regards,
The Chttrix Team
    `
    };
};

module.exports = {
    workspaceInvitationTemplate
};
