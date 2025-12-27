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

module.exports = {
    generateVerificationCode,
    emailVerificationTemplate
};
