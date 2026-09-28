const Company = require('../../../models/Company');

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
 * Writes Company.securitySettings (the schema field). Accepts the schema names
 * and the older client names (twoFactorAuth, sessionTimeout, ipWhitelist,
 * passwordPolicy.minLength). Only provided fields change.
 */
async function updateSecuritySettings(companyId, securityData = {}) {
    const d = securityData || {};
    const pick = (...vals) => vals.find((v) => v !== undefined);
    const set = {};
    const mfa = pick(d.mfaRequired, d.twoFactorAuth?.required, typeof d.twoFactorAuth === 'boolean' ? d.twoFactorAuth : undefined);
    if (mfa !== undefined) set['securitySettings.mfaRequired'] = !!mfa;
    const minLen = pick(d.passwordMinLength, d.passwordPolicy?.minLength);
    if (minLen !== undefined) set['securitySettings.passwordMinLength'] = Math.max(6, Math.min(128, Number(minLen) || 8));
    const timeout = pick(d.sessionTimeoutMinutes, d.sessionTimeout);
    if (timeout !== undefined) set['securitySettings.sessionTimeoutMinutes'] = Math.max(5, Math.min(43200, Number(timeout) || 1440));
    const ips = pick(d.allowedIpRanges, d.ipWhitelist);
    if (ips !== undefined) set['securitySettings.allowedIpRanges'] = (Array.isArray(ips) ? ips : []).map(String).filter(Boolean).slice(0, 100);
    if (d.enforceSSO !== undefined) set['securitySettings.enforceSSO'] = !!d.enforceSSO;

    const company = Object.keys(set).length
        ? await Company.findByIdAndUpdate(companyId, { $set: set }, { new: true, runValidators: true })
        : await Company.findById(companyId);

    if (!company) {
        return null;
    }

    return company.securitySettings;
}

async function updateDomainSettings(companyId, domainData) {
    const { autoJoin, ssoEnabled, ssoProvider } = domainData;

    const company = await Company.findById(companyId);
    if (!company) {
        throw new Error('Company not found');
    }

    
    if (autoJoin && !company.domainVerified) {
        throw new Error('Domain must be verified before enabling auto-join');
    }

    
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

module.exports = {
    updateCompanyProfile,
    updateSecuritySettings,
    updateDomainSettings
};
