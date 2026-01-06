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

module.exports = {
  generateVerificationCode,
  emailVerificationTemplate,
  companyApprovedTemplate,
  companyRejectedTemplate
};
