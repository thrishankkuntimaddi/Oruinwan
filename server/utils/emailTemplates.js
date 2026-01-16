// server/utils/emailTemplates.js

/**
 * Generate a 6-digit verification code
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Email verification template
 */
const emailVerificationTemplate = (username, code) => {
  return {
    subject: 'Verify your email address - Chttrix',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .code-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 25px 0; border-radius: 8px; }
          .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Email Verification</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${username}</strong>,</p>
            <p>Thank you for adding a new email address to your Chttrix account! Please verify your email address by entering this code:</p>
            
            <div class="code-box">
              <div class="code">${code}</div>
            </div>
            
            <p><strong>This code will expire in 15 minutes.</strong></p>
            
            <p>If you didn't request this verification, please ignore this email. Your account remains secure.</p>
            
            <div class="footer">
              <p>This is an automated message from Chttrix. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} Chttrix. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hi ${username},

Thank you for adding a new email address to your Chttrix account!

Your verification code is: ${code}

This code will expire in 15 minutes.

If you didn't request this verification, please ignore this email.

Best regards,
The Chttrix Team
    `
  };
};

/**
 * Company Approved Template
 */
const companyApprovedTemplate = (username, companyName, loginUrl, customMessage) => {
  return {
    subject: `🎉 You're In! ${companyName} is Verified`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f5; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
          .header { background: linear-gradient(135deg, #4f46e5 0%, #000000 100%); color: white; padding: 40px 40px; text-align: center; }
          .logo { font-size: 24px; font-weight: 900; letter-spacing: -1px; margin-bottom: 20px; display: block; text-decoration: none; color: white; }
          .content { padding: 40px; }
          .message-box { background: #eff6ff; border-left: 4px solid #4f46e5; padding: 20px; margin: 25px 0; border-radius: 8px; color: #3730a3; }
          .custom-message { font-style: italic; color: #4b5563; margin-bottom: 25px; padding: 15px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; }
          .button { display: inline-block; padding: 16px 32px; background: #000000; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 10px 0; transition: transform 0.2s; }
          .button:hover { transform: translateY(-2px); }
          .footer { background: #fafafa; padding: 30px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }
          h1 { margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -1px; }
          h2 { color: #1f2937; margin-top: 0; font-size: 20px; }
          p { color: #4b5563; margin-bottom: 20px; font-size: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Chttrix</div>
            <h1>You're Ready to Launch 🚀</h1>
          </div>
          <div class="content">
            <h2>Hello ${username},</h2>
            <p>Great news! We've verified <strong>${companyName}</strong>. Your workspace has been provisioned and is ready for your team.</p>
            
            ${customMessage ? `
            <div class="custom-message">
              "${customMessage}"
            </div>` : ''}

            <div class="message-box">
              <strong>✨ What's unlocked:</strong><br/>
              Full access to channels, team management, and collaboration tools.
            </div>

            <center>
              <a href="${loginUrl}" class="button">Go to Workspace →</a>
            </center>
            
            <p style="text-align: center; margin-top: 30px; font-size: 14px;">
              Or verify at: <a href="${loginUrl}" style="color: #4f46e5;">${loginUrl}</a>
            </p>
          </div>
          <div class="footer">
            <p style="margin-bottom: 10px;">Sent with ❤️ from SV</p>
            © ${new Date().getFullYear()} Chttrix Inc. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Welcome to Chttrix! Your company ${companyName} has been verified. Login here: ${loginUrl}`
  };
};

/**
 * Company Rejected Template
 */
const companyRejectedTemplate = (username, companyName, reason, customMessage) => {
  return {
    subject: `Update on your Chttrix Application`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f5; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .header { background: #18181b; color: white; padding: 40px; text-align: center; }
          .content { padding: 40px; }
          .reason-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 25px 0; border-radius: 8px; color: #991b1b; }
          .custom-message { font-style: italic; color: #4b5563; margin-bottom: 25px; padding: 15px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; }
          .footer { background: #fafafa; padding: 30px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }
          h1 { margin: 0; font-size: 24px; font-weight: 700; }
          h2 { color: #1f2937; margin-top: 0; font-size: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Application Update</h1>
          </div>
          <div class="content">
            <h2>Dear ${username},</h2>
            <p>Thank you for your interest in Chttrix. We've reviewed your application for <strong>${companyName}</strong>.</p>
            
            <p>Unfortunately, we cannot proceed with your verification at this time.</p>

            ${customMessage ? `
            <div class="custom-message">
              "${customMessage}"
            </div>` : ''}
            
            <div class="reason-box">
              <strong>One or more requirements were not met:</strong><br/>
              ${reason || customMessage || "Application criteria not met."}
            </div>

            <p>If you believe this decision was made in error, please reply to this email or contact support.</p>
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} Chttrix Inc. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Your application for ${companyName} was rejected. Reason: ${reason}`
  };
};

/**
 * Employee Credentials Template (for Admin-created employees)
 */
const employeeCredentialsTemplate = (fullName, companyName, companyEmail, temporaryPassword, loginUrl) => {
  return {
    subject: `Welcome to ${companyName} - Your Chttrix Account`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f5; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #4f46e5 0%, #000000 100%); color: white; padding: 40px; text-align: center; }
          .logo { font-size: 24px; font-weight: 900; letter-spacing: -1px; margin-bottom: 10px; }
          .content { padding: 40px; }
          .credentials-box { background: #f9fafb; border: 2px solid #e5e7eb; padding: 25px; margin: 25px 0; border-radius: 12px; }
          .credential-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
          .credential-row:last-child { border-bottom: none; }
          .credential-label { font-weight: 600; color: #6b7280; }
          .credential-value { font-family: 'Courier New', monospace; color: #111827; font-weight: 600; }
          .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 8px; color: #92400e; }
          .button { display: inline-block; padding: 16px 32px; background: #000000; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 20px 0; }
          .footer { background: #fafafa; padding: 30px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }
          h1 { margin: 0; font-size: 28px; font-weight: 800; }
          h2 { color: #1f2937; margin-top: 0; font-size: 20px; }
          p { color: #4b5563; margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Chttrix</div>
            <h1>Welcome to ${companyName}!</h1>
          </div>
          <div class="content">
            <h2>Hello ${fullName},</h2>
            <p>Your administrator has created a Chttrix account for you at <strong>${companyName}</strong>. Below are your login credentials to get started.</p>
            
            <div class="credentials-box">
              <div class="credential-row">
                <span class="credential-label">Company Email:</span>
                <span class="credential-value">${companyEmail}</span>
              </div>
              <div class="credential-row">
                <span class="credential-label">Temporary Password:</span>
                <span class="credential-value">${temporaryPassword}</span>
              </div>
            </div>

            <div class="warning-box">
              <strong>⚠️ Security Reminder:</strong> You'll be prompted to change your password when you first log in. We recommend choosing a strong, unique password.
            </div>

            <center>
              <a href="${loginUrl}" class="button">Login to Chttrix →</a>
            </center>
            
            <p style="text-align: center; margin-top: 20px; font-size: 14px;">
              Or visit: <a href="${loginUrl}" style="color: #4f46e5;">${loginUrl}</a>
            </p>

            <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
              <strong>Next Steps:</strong><br/>
              1. Click the button above to log in<br/>
              2. Change your temporary password<br/>
              3. Start collaborating with your team!
            </p>
          </div>
          <div class="footer">
            <p><strong>Need help?</strong> Contact your administrator or visit our support center.</p>
            © ${new Date().getFullYear()} Chttrix Inc. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Welcome to ${companyName}!

Hello ${fullName},

Your administrator has created a Chttrix account for you. Here are your login credentials:

Company Email: ${companyEmail}
Temporary Password: ${temporaryPassword}

Login here: ${loginUrl}

IMPORTANT: You'll be prompted to change your password when you first log in for security.

Next Steps:
1. Visit ${loginUrl}
2. Log in with the credentials above
3. Change your temporary password
4. Start collaborating with your team!

If you have any questions, please contact your administrator.

Best regards,
The Chttrix Team
    `
  };
};

/**
 * Password Reset Template
 */
const passwordResetTemplate = (username, resetUrl) => {
  return {
    subject: '🔐 Reset Your Chttrix Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f5; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; }
          .logo { font-size: 24px; font-weight: 900; letter-spacing: -1px; margin-bottom: 10px; }
          .icon { font-size: 48px; margin-bottom: 10px; }
          .content { padding: 40px; }
          .button { display: inline-block; padding: 16px 32px; background: #667eea; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 20px 0; transition: background 0.3s; }
          .button:hover { background: #5568d3; }
          .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 8px; color: #92400e; }
          .info-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 25px 0; border-radius: 8px; color: #1e40af; }
          .footer { background: #fafafa; padding: 30px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }
          h1 { margin: 0; font-size: 28px; font-weight: 800; }
          h2 { color: #1f2937; margin-top: 0; font-size: 20px; }
          p { color: #4b5563; margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Chttrix</div>
            <div class="icon">🔐</div>
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${username},</h2>
            <p>We received a request to reset your Chttrix password. Click the button below to create a new password:</p>
            
            <center>
              <a href="${resetUrl}" class="button">Reset Password →</a>
            </center>
            
            <p style="text-align: center; margin-top: 20px; font-size: 14px; color: #6b7280;">
              Or copy and paste this link: <br/>
              <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
            </p>

            <div class="warning-box">
              <strong>⏰ This link expires in 1 hour</strong> for your security.
            </div>

            <div class="info-box">
              <strong>Didn't request this?</strong><br/>
              If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.
            </div>

            <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
              <strong>Security Tips:</strong><br/>
              • Never share your password with anyone<br/>
              • Use a unique password for Chttrix<br/>
              • Enable two-factor authentication when available
            </p>
          </div>
          <div class="footer">
            <p><strong>Need help?</strong> Contact our support team</p>
            <p style="margin-top: 10px;">This is an automated message. Please do not reply to this email.</p>
            © ${new Date().getFullYear()} Chttrix Inc. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hello ${username},

We received a request to reset your Chttrix password.

Reset your password here: ${resetUrl}

This link expires in 1 hour for your security.

If you didn't request this, you can safely ignore this email.

Best regards,
The Chttrix Team
    `
  };
};

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
  generateVerificationCode,
  emailVerificationTemplate,
  companyApprovedTemplate,
  companyRejectedTemplate,
  employeeCredentialsTemplate,
  passwordResetTemplate,
  workspaceInvitationTemplate
};
