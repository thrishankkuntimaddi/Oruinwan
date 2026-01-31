// server/utils/emailTemplates/auth.js
// Authentication-related email templates

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
 * Password Set Template (for OAuth users setting password)
 */
const passwordSetTemplate = (username, authProvider) => {
    const providerName = authProvider.charAt(0).toUpperCase() + authProvider.slice(1);

    return {
        subject: '🔐 Password Set Successfully - Chttrix',
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f5; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px; text-align: center; }
          .logo { font-size: 24px; font-weight: 900; letter-spacing: -1px; margin-bottom: 10px; }
          .icon { font-size: 48px; margin-bottom: 10px; }
          .content { padding: 40px; }
          .success-box { background: #d1fae5; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 8px; color: #065f46; }
          .info-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 25px 0; border-radius: 8px; color: #1e40af; }
          .footer { background: #fafafa; padding: 30px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }
          h1 { margin: 0; font-size: 28px; font-weight: 800; }
          h2 { color: #1f2937; margin-top: 0; font-size: 20px; }
          p { color: #4b5563; margin-bottom: 15px; }
          ul { color: #4b5563; margin: 15px 0; padding-left: 25px; }
          li { margin-bottom: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Chttrix</div>
            <div class="icon">✅</div>
            <h1>Password Set Successfully!</h1>
          </div>
          <div class="content">
            <h2>Hello ${username},</h2>
            <p>Great news! You've successfully set a password for your Chttrix account.</p>
            
            <div class="success-box">
              <strong>✨ You now have two login options:</strong><br/>
              <ul style="margin: 10px 0;">
                <li><strong>${providerName} OAuth</strong> - Your original login method</li>
                <li><strong>Email + Password</strong> - Your new backup option</li>
              </ul>
            </div>

            <div class="info-box">
              <strong>🔒 Security Reminder:</strong><br/>
              Your ${providerName} account login remains active and unchanged. The password you just set provides an additional way to access your account if needed.
            </div>

            <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
              <strong>Security Best Practices:</strong><br/>
              • Keep your password secure and don't share it with anyone<br/>
              • Use a unique password that's different from other services<br/>
              • Consider enabling two-factor authentication when available<br/>
              • You can always use ${providerName} to sign in quickly
            </p>

            <p style="margin-top: 25px;">If you didn't set this password, please contact our support team immediately.</p>
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

Great news! You've successfully set a password for your Chttrix account.

YOU NOW HAVE TWO LOGIN OPTIONS:
✓ ${providerName} OAuth - Your original login method
✓ Email + Password - Your new backup option

SECURITY REMINDER:
Your ${providerName} account login remains active and unchanged. The password you just set provides an additional way to access your account if needed.

Security Best Practices:
• Keep your password secure and don't share it with anyone
• Use a unique password that's different from other services
• Consider enabling two-factor authentication when available
• You can always use ${providerName} to sign in quickly

If you didn't set this password, please contact our support team immediately.

Best regards,
The Chttrix Team
    `
    };
};

/**
 * Resend Verification Email Template
 */
const resendVerificationTemplate = (username, verificationUrl) => {
    return {
        subject: '📧 Verify Your Email - Chttrix Account Activation',
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f5; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 40px; text-align: center; }
          .logo { font-size: 24px; font-weight: 900; letter-spacing: -1px; margin-bottom: 10px; }
          .icon { font-size: 48px; margin-bottom: 10px; }
          .content { padding: 40px; }
          .urgent-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 12px; text-align: center; }
          .urgent-text { font-size: 18px; font-weight: bold; color: #92400e; margin-bottom: 15px; }
          .button { display: inline-block; padding: 16px 32px; background: #f59e0b; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 20px 0; transition: background 0.3s; }
          .button:hover { background: #d97706; }
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
            <div class="icon">📧</div>
            <h1>Email Verification Required</h1>
          </div>
          <div class="content">
            <h2>Hello ${username},</h2>
            <p>You attempted to login, but your account isn't verified yet. To access your Chttrix account, please verify your email address.</p>
            
            <div class="urgent-box">
              <div class="urgent-text">⚠️ Action Required</div>
              <p style="margin: 0; color: #92400e;">Your account is almost ready! Just one click to activate it.</p>
            </div>

            <center>
              <a href="${verificationUrl}" class="button">Verify Email Address →</a>
            </center>
            
            <p style="text-align: center; margin-top: 20px; font-size: 14px; color: #6b7280;">
              Or copy and paste this link: <br/>
              <a href="${verificationUrl}" style="color: #f59e0b; word-break: break-all;">${verificationUrl}</a>
            </p>

            <div class="info-box">
              <strong>Why verify?</strong><br/>
              Email verification helps us ensure account security and allows you to recover your account if needed.
            </div>

            <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
              <strong>Didn't sign up?</strong><br/>
              If you didn't create a Chttrix account, you can safely ignore this email.
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

You attempted to login, but your account isn't verified yet.

ACTION REQUIRED:
To access your Chttrix account, please verify your email address.

Verify your email here: ${verificationUrl}

Why verify?
Email verification helps us ensure account security and allows you to recover your account if needed.

Didn't sign up?
If you didn't create a Chttrix account, you can safely ignore this email.

Best regards,
The Chttrix Team
    `
    };
};

module.exports = {
    generateVerificationCode,
    emailVerificationTemplate,
    passwordResetTemplate,
    passwordSetTemplate,
    resendVerificationTemplate
};
