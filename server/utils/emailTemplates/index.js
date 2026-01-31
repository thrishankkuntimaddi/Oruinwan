// server/utils/emailTemplates/index.js
// Central aggregator for all email templates (backward compatibility)

const auth = require('./auth');
const company = require('./company');
const workspace = require('./workspace');
const security = require('./security');

// Re-export all templates individually for backward compatibility
// Existing code can still use: const { emailVerificationTemplate } = require('./utils/emailTemplates');
module.exports = {
    // Auth templates
    generateVerificationCode: auth.generateVerificationCode,
    emailVerificationTemplate: auth.emailVerificationTemplate,
    passwordResetTemplate: auth.passwordResetTemplate,
    passwordSetTemplate: auth.passwordSetTemplate,
    resendVerificationTemplate: auth.resendVerificationTemplate,

    // Company templates
    companyApprovedTemplate: company.companyApprovedTemplate,
    companyRejectedTemplate: company.companyRejectedTemplate,
    employeeCredentialsTemplate: company.employeeCredentialsTemplate,

    // Workspace templates
    workspaceInvitationTemplate: workspace.workspaceInvitationTemplate,

    // Security templates
    loginDetectionTemplate: security.loginDetectionTemplate,

    // Also export category objects for selective imports (new option)
    // Usage: const authEmails = require('./utils/emailTemplates').auth;
    auth,
    company,
    workspace,
    security
};
