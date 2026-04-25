const sendEmail = require('../../utils/sendEmail');
const {
    newDeviceSignInTemplate,
    passwordChangedTemplate,
    allDevicesRevokedTemplate,
} = require('../../utils/emailTemplates');

exports.sendSecurityNotification = async ({
    user,
    eventType,
    auditEvent = {}
}) => {
    try {
        
        if (!user || !user.email) {
            console.warn('⚠️ [NOTIFICATION] Cannot send notification - no user email');
            return;
        }

        
        const notifiableEvents = [
            'LOGIN_NEW_DEVICE',
            'PASSWORD_CHANGED',
            'ALL_DEVICES_REVOKED'
        ];

        if (!notifiableEvents.includes(eventType)) {
            
            return;
        }

        
        const emailContent = buildEmailContent(eventType, auditEvent, user);

        if (!emailContent) {
            console.warn('⚠️ [NOTIFICATION] Failed to build email content');
            return;
        }

        
        await sendEmail({
            to: user.email,
            subject: emailContent.subject,
            html: emailContent.html
        });

        console.log(`✅ [NOTIFICATION] Sent ${eventType} notification to ${user.email}`);

    } catch (error) {
        
        console.warn(`⚠️ [NOTIFICATION] Failed to send ${eventType} notification (non-critical):`, error.message);
        
    }
};

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
