const logger = require('../../../utils/logger');
const sendEmail = require('../../../utils/sendEmail');

/**
 * Notification emails (mentions, assignments, digests). Delegates to the shared
 * mailer so the same provider configuration (Brevo API, then SMTP) applies to
 * every email the platform sends. Returns null on failure so callers never
 * block a notification on email delivery.
 */
async function sendEmailNotification({ to, subject, html, text }) {
    if (!to) {
        logger.warn('[EmailService] sendEmailNotification called without recipient');
        return null;
    }
    try {
        const info = await sendEmail({
            to,
            subject,
            html,
            text: text || (html ? html.replace(/<[^>]*>/g, '') : ''),
        });
        logger.info(`[EmailService] Notification email sent to ${to} via ${info.provider}`);
        return info;
    } catch (err) {
        logger.error(`[EmailService] Failed to send notification email to ${to}: ${err.message}`);
        return null;
    }
}

module.exports = { sendEmailNotification };
