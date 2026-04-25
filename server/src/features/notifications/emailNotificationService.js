const nodemailer = require('nodemailer');
const logger = require('../../../utils/logger');

let _transporter = null;

async function getTransporter() {
    if (_transporter) return _transporter;

    const hasSmtp = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

    if (hasSmtp) {
        _transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        logger.info('[EmailService] Using configured SMTP transport');
    } else {
        
        const testAccount = await nodemailer.createTestAccount();
        _transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
        logger.info('[EmailService] Using Ethereal test transport (no SMTP configured)');
    }

    return _transporter;
}

async function sendEmailNotification({ to, subject, html, text }) {
    if (!to) {
        logger.warn('[EmailService] sendEmailNotification called without recipient');
        return null;
    }

    try {
        const transporter = await getTransporter();
        const from = process.env.SMTP_FROM || '"Chttrix" <no-reply@chttrix.app>';

        const info = await transporter.sendMail({
            from,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, ''), 
        });

        logger.info(`[EmailService] Email sent to ${to} | id: ${info.messageId}`);

        
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            logger.info(`[EmailService] Preview: ${previewUrl}`);
        }

        return info;
    } catch (err) {
        logger.error(`[EmailService] Failed to send email to ${to}:`, err.message);
        return null;
    }
}

module.exports = { sendEmailNotification };
