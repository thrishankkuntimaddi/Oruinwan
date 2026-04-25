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
