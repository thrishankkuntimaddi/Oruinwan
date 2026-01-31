// server/utils/emailTemplates/security.js
// Security notification email templates

/**
 * Login Detection Template
 */
const loginDetectionTemplate = (username, ipAddress, deviceInfo, timestamp, loginUrl) => {
    const formattedTime = new Date(timestamp).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });

    return {
        subject: '🔔 New Login Detected - Chttrix',
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f5; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 40px; text-align: center; }
          .logo { font-size: 24px; font-weight: 900; letter-spacing: -1px; margin-bottom: 10px; }
          .icon { font-size: 48px; margin-bottom: 10px; }
          .content { padding: 40px; }
          .login-details { background: #f9fafb; border: 2px solid #e5e7eb; padding: 25px; margin: 25px 0; border-radius: 12px; }
          .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { font-weight: 600; color: #6b7280; }
          .detail-value { font-family: 'Courier New', monospace; color: #111827; font-weight: 600; }
          .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 8px; color: #92400e; }
          .button { display: inline-block; padding: 14px 28px; background: #dc2626; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 15px 0; }
          .button-secondary { display: inline-block; padding: 14px 28px; background: #3b82f6; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 15px 10px; }
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
            <div class="icon">🔔</div>
            <h1>New Login Detected</h1>
          </div>
          <div class="content">
            <h2>Hello ${username},</h2>
            <p>We detected a new login to your Chttrix account. If this was you, no action is needed. If you don't recognize this login, please secure your account immediately.</p>
            
            <div class="login-details">
              <div class="detail-row">
                <span class="detail-label">📅 Time:</span>
                <span class="detail-value">${formattedTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">💻 Device:</span>
                <span class="detail-value">${deviceInfo.formattedString || deviceInfo}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🌍 IP Address:</span>
                <span class="detail-value">${ipAddress}</span>
              </div>
            </div>

            <div class="warning-box">
              <strong>⚠️ Not You?</strong><br/>
              If you don't recognize this login, your account may be compromised. Click the button below to change your password immediately.
            </div>

            <center>
              <a href="${loginUrl}/reset-password" class="button">Change Password →</a>
              <a href="${loginUrl}/sessions" class="button-secondary">Manage Sessions →</a>
            </center>
            
            <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
              <strong>Security Tips:</strong><br/>
              • Review your active sessions regularly<br/>
              • Use a strong, unique password<br/>
              • Enable two-factor authentication if available<br/>
              • Never share your password with anyone
            </p>
          </div>
          <div class="footer">
            <p><strong>Need help?</strong> Contact our support team</p>
            <p style="margin-top: 10px;">This is an automated security notification. Please do not reply to this email.</p>
            © ${new Date().getFullYear()} Chttrix Inc. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `,
        text: `
Hello ${username},

We detected a new login to your Chttrix account.

LOGIN DETAILS:
Time: ${formattedTime}
Device: ${deviceInfo.formattedString || deviceInfo}
IP Address: ${ipAddress}

If this was you, no action is needed.

NOT YOU?
If you don't recognize this login, your account may be compromised. 
Change your password immediately: ${loginUrl}/reset-password
Manage your sessions: ${loginUrl}/sessions

Security Tips:
• Review your active sessions regularly
• Use a strong, unique password
• Enable two-factor authentication if available
• Never share your password with anyone

Best regards,
The Chttrix Team
    `
    };
};

module.exports = {
    loginDetectionTemplate
};
