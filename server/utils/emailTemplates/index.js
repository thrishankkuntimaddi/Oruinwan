const auth = require('./auth');
const company = require('./company');
const workspace = require('./workspace');
const security = require('./security');

module.exports = {
    
    generateVerificationCode: auth.generateVerificationCode,
    emailVerificationTemplate: auth.emailVerificationTemplate,
    passwordResetTemplate: auth.passwordResetTemplate,
    passwordSetTemplate: auth.passwordSetTemplate,
    resendVerificationTemplate: auth.resendVerificationTemplate,

    
    companyApprovedTemplate: company.companyApprovedTemplate,
    companyRejectedTemplate: company.companyRejectedTemplate,
    employeeCredentialsTemplate: company.employeeCredentialsTemplate,

    
    workspaceInvitationTemplate: workspace.workspaceInvitationTemplate,

    
    loginDetectionTemplate: security.loginDetectionTemplate,

    
    
    auth,
    company,
    workspace,
    security
};
