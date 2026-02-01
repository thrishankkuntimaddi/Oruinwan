/**
 * Settings Service - Company Settings Management
 * 
 * Handles company profile, security, and domain/SSO settings updates.
 * Extracted from companyController.js for better separation of concerns.
 * 
 * @module features/company/settings.service
 */

const Company = require('../../models/Company');

/**
 * Update company profile settings
 * @param {string} companyId - Company ID
 * @param {Object} profileData - Profile fields to update
 * @param {string} profileData.name - Company name
 * @param {string} profileData.description - Company description
 * @param {string} profileData.industry - Industry type
 * @param {string} profileData.size - Company size
 * @param {string} profileData.location - Location
 * @param {string} profileData.website - Website URL
 * @param {string} profileData.phone - Contact phone
 * @param {Object} profileData.address - Address object
 * @returns {Promise<Object>} Updated company document
 */
async function updateCompanyProfile(companyId, profileData) {
    const { name, description, industry, size, location, website, phone, address } = profileData;

    const company = await Company.findByIdAndUpdate(
        companyId,
        {
            name,
            description,
            industry,
            size,
            location,
            website,
            phone,
            address
        },
        { new: true, runValidators: true }
    );

    return company;
}

/**
 * Update company security settings
 * @param {string} companyId - Company ID
 * @param {Object} securityData - Security settings
 * @param {Object} securityData.passwordPolicy - Password policy config
 * @param {boolean} securityData.twoFactorAuth - 2FA enabled/disabled
 * @param {number} securityData.sessionTimeout - Session timeout in minutes
 * @param {Array} securityData.ipWhitelist - Allowed IP addresses
 * @returns {Promise<Object>} Updated security settings
 */
async function updateSecuritySettings(companyId, securityData) {
    const { passwordPolicy, twoFactorAuth, sessionTimeout, ipWhitelist } = securityData;

    const company = await Company.findByIdAndUpdate(
        companyId,
        {
            'settings.security': {
                passwordPolicy,
                twoFactorAuth,
                sessionTimeout,
                ipWhitelist
            }
        },
        { new: true, runValidators: true }
    );

    if (!company) {
        return null;
    }

    return company.settings?.security;
}

/**
 * Update domain and SSO settings
 * @param {string} companyId - Company ID
 * @param {Object} domainData - Domain/SSO settings
 * @param {boolean} domainData.autoJoin - Auto-join by domain enabled
 * @param {boolean} domainData.ssoEnabled - SSO enabled
 * @param {string} domainData.ssoProvider - SSO provider name
 * @returns {Promise<{autoJoin: boolean, sso: Object, company: Object}>}
 * @throws {Error} If domain not verified and autoJoin requested
 */
async function updateDomainSettings(companyId, domainData) {
    const { autoJoin, ssoEnabled, ssoProvider } = domainData;

    const company = await Company.findById(companyId);
    if (!company) {
        throw new Error('Company not found');
    }

    // Validate: can only enable autoJoin if domain is verified
    if (autoJoin && !company.domainVerified) {
        throw new Error('Domain must be verified before enabling auto-join');
    }

    // Update settings
    company.autoJoinByDomain = autoJoin;
    if (company.settings) {
        company.settings.sso = { enabled: ssoEnabled, provider: ssoProvider };
    }

    await company.save();

    return {
        autoJoin,
        sso: company.settings?.sso,
        company
    };
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
    updateCompanyProfile,
    updateSecuritySettings,
    updateDomainSettings
};
