// server/src/services/securityNotification.service.js

/**
 * Security Notification Service
 * PHASE 4B: Email notifications for critical security events
 *
 * CRITICAL RULES:
 * - NEVER throw errors
 * - NEVER block request flow
 * - Fire-and-forget delivery
 * - Best-effort only
 * - No sensitive data in emails (no keys, passwords, ciphertext)
 */

const sendEmail = require('../../utils/sendEmail');
const {
    newDeviceSignInTemplate,
    passwordChangedTemplate,
    allDevicesRevokedTemplate,
} = require('../../utils/emailTemplates');

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
    const name = user.username || user.name || 'there';

    switch (eventType) {
        case 'LOGIN_NEW_DEVICE': {
            const deviceName = auditEvent.deviceName || 'Unknown Device';
            const platform   = auditEvent.platform   || 'Unknown';
            const location   = auditEvent.ipAddress  ? `IP ${auditEvent.ipAddress}` : '';
            return newDeviceSignInTemplate(name, deviceName, platform, location, formattedTime);
        }
        case 'PASSWORD_CHANGED': {
            const deviceName = auditEvent.deviceName || 'Unknown Device';
            return passwordChangedTemplate(name, deviceName, formattedTime);
        }
        case 'ALL_DEVICES_REVOKED': {
            const revokedCount = auditEvent.metadata?.revokedCount || 0;
            const deviceName   = auditEvent.deviceName || 'Unknown Device';
            return allDevicesRevokedTemplate(name, revokedCount, deviceName, formattedTime);
        }
        default:
            return null;
    }
}

// (all old buildXxx functions and local sendEmail stub removed — using emailTemplates.js and utils/sendEmail.js)
