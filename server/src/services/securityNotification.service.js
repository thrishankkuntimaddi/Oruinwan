// server/src/services/securityNotification.service.js

/**
 * Security Notification Service
 * 
 * PHASE 4B: Email notifications for critical security events
 * 
 * CRITICAL RULES:
 * - NEVER throw errors
 * - NEVER block request flow
 * - Fire-and-forget delivery
 * - Best-effort only
 * - No sensitive data in emails (no keys, passwords, ciphertext)
 */

/**
 * Send security notification email
 * 
 * @param {Object} params
 * @param {Object} params.user - User object with email
 * @param {string} params.eventType - Type of security event
 * @param {Object} params.auditEvent - Audit event data (optional)
 * @returns {Promise<void>}
 */
exports.sendSecurityNotification = async ({
    user,
    eventType,
    auditEvent = {}
}) => {
    try {
        // Validate user has email
        if (!user || !user.email) {
            console.warn('⚠️ [NOTIFICATION] Cannot send notification - no user email');
            return;
        }

        // Decide if this event should trigger notification
        const notifiableEvents = [
            'LOGIN_NEW_DEVICE',
            'PASSWORD_CHANGED',
            'ALL_DEVICES_REVOKED'
        ];

        if (!notifiableEvents.includes(eventType)) {
            // Not a notifiable event, skip silently
            return;
        }

        // Build email content
        const emailContent = buildEmailContent(eventType, auditEvent, user);

        if (!emailContent) {
            console.warn('⚠️ [NOTIFICATION] Failed to build email content');
            return;
        }

        // Send email (fire-and-forget)
        await sendEmail({
            to: user.email,
            subject: emailContent.subject,
            html: emailContent.html
        });

        console.log(`✅ [NOTIFICATION] Sent ${eventType} notification to ${user.email}`);

    } catch (error) {
        // CRITICAL: Never throw, never block
        console.warn(`⚠️ [NOTIFICATION] Failed to send ${eventType} notification (non-critical):`, error.message);
        // Continue silently
    }
};

/**
 * Build email content based on event type
 * @private
 */
function buildEmailContent(eventType, auditEvent, user) {
    const timestamp = auditEvent.createdAt || new Date();
    const formattedTime = new Date(timestamp).toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'short'
    });

    switch (eventType) {
        case 'LOGIN_NEW_DEVICE':
            return buildLoginNewDeviceEmail(auditEvent, formattedTime, user);

        case 'PASSWORD_CHANGED':
            return buildPasswordChangedEmail(auditEvent, formattedTime, user);

        case 'ALL_DEVICES_REVOKED':
            return buildAllDevicesRevokedEmail(auditEvent, formattedTime, user);

        default:
            return null;
    }
}

/**
 * Build LOGIN_NEW_DEVICE email
 * @private
 */
function buildLoginNewDeviceEmail(auditEvent, formattedTime, user) {
    const deviceName = auditEvent.deviceName || 'Unknown Device';
    const platform = auditEvent.platform || 'unknown';
    const location = auditEvent.ipAddress ? `from IP ${auditEvent.ipAddress}` : '';

    return {
        subject: 'New device signed in to your Chttrix account',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a73e8;">New Device Sign-in</h2>
                
                <p>Hi ${user.name || 'there'},</p>
                
                <p>A new device was used to sign in to your Chttrix account.</p>
                
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Device:</strong> ${deviceName}</p>
                    <p style="margin: 5px 0;"><strong>Platform:</strong> ${platform}</p>
                    ${location ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${location}</p>` : ''}
                    <p style="margin: 5px 0;"><strong>Time:</strong> ${formattedTime}</p>
                </div>
                
                <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>⚠️ If this wasn't you:</strong></p>
                    <p style="margin: 10px 0 0 0;">
                        Please secure your account immediately by changing your password and revoking unknown devices.
                    </p>
                </div>
                
                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                    This is an automated security notification from Chttrix. 
                    Please do not reply to this email.
                </p>
            </div>
        `
    };
}

/**
 * Build PASSWORD_CHANGED email
 * @private
 */
function buildPasswordChangedEmail(auditEvent, formattedTime, user) {
    const deviceName = auditEvent.deviceName || 'Unknown Device';

    return {
        subject: 'Your Chttrix password was changed',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #d93025;">Password Changed</h2>
                
                <p>Hi ${user.name || 'there'},</p>
                
                <p>Your Chttrix account password was successfully changed.</p>
                
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Device used:</strong> ${deviceName}</p>
                    <p style="margin: 5px 0;"><strong>Time:</strong> ${formattedTime}</p>
                </div>
                
                <div style="background-color: #f8d7da; border-left: 4px solid #d93025; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>⚠️ If this wasn't you:</strong></p>
                    <p style="margin: 10px 0 0 0;">
                        Your account may have been compromised. Please attempt to reset your password immediately. 
                        If you cannot access your account, contact support.
                    </p>
                </div>
                
                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                    This is an automated security notification from Chttrix. 
                    Please do not reply to this email.
                </p>
            </div>
        `
    };
}

/**
 * Build ALL_DEVICES_REVOKED email
 * @private
 */
function buildAllDevicesRevokedEmail(auditEvent, formattedTime, user) {
    const revokedCount = auditEvent.metadata?.revokedCount || 0;
    const deviceName = auditEvent.deviceName || 'Unknown Device';

    return {
        subject: 'All other devices were signed out of your Chttrix account',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a73e8;">All Other Devices Signed Out</h2>
                
                <p>Hi ${user.name || 'there'},</p>
                
                <p>All other devices (${revokedCount} device${revokedCount !== 1 ? 's' : ''}) were signed out of your Chttrix account.</p>
                
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Initiated by:</strong> ${deviceName}</p>
                    <p style="margin: 5px 0;"><strong>Time:</strong> ${formattedTime}</p>
                </div>
                
                <div style="background-color: #d1ecf1; border-left: 4px solid #1a73e8; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0;">
                        This is a security action. If you initiated this action, no further steps are needed.
                    </p>
                </div>
                
                <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>⚠️ If this wasn't you:</strong></p>
                    <p style="margin: 10px 0 0 0;">
                        Please change your password immediately and review your account security settings.
                    </p>
                </div>
                
                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                    This is an automated security notification from Chttrix. 
                    Please do not reply to this email.
                </p>
            </div>
        `
    };
}

/**
 * Send email via email provider
 * @private
 */
async function sendEmail({ to, subject, _html }) {
    try {
        // TODO: Replace with actual email provider (SendGrid, AWS SES, etc.)
        // For now, log to console in development

        if (process.env.NODE_ENV === 'production') {
            // In production, use actual email service
            // Example with nodemailer or SendGrid:
            // await emailClient.send({ to, subject, html });

            console.log(`📧 [EMAIL] Would send to ${to}: ${subject}`);
        } else {
            // In development, just log
            console.log(`📧 [EMAIL] DEV MODE - Would send to ${to}:`);
            console.log(`   Subject: ${subject}`);
            console.log(`   (HTML content suppressed in logs)`);
        }

        // For production, uncomment and configure:
        /*
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        
        await sgMail.send({
            to,
            from: process.env.EMAIL_FROM || 'security@chttrix.com',
            subject,
            html
        });
        */

    } catch (error) {
        // Log but don't throw
        console.warn('⚠️ [EMAIL] Failed to send email:', error.message);
    }
}
