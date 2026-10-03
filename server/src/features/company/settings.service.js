const org = require('../../identity/queries/org');

/**
 * Profile edits. name and website are columns; the descriptive extras live in
 * metadata.profile and contact details in settings (where the client reads them).
 */
async function updateCompanyProfile(companyId, profileData) {
    const { name, description, industry, size, location, website, phone, address } = profileData;
    const patch = {};
    if (name !== undefined) patch.name = name;
    if (website !== undefined) patch.website = website;
    const profile = Object.fromEntries(Object.entries({ description, industry, size, location }).filter(([, v]) => v !== undefined));
    if (Object.keys(profile).length) patch.metadata = { profile };
    const settings = Object.fromEntries(Object.entries({ phone, address }).filter(([, v]) => v !== undefined));
    if (Object.keys(settings).length) patch.settings = settings;

    const company = await org.updateCompany(companyId, patch);
    return company ? org.publicCompany(company) : null;
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
        ? await org.updateCompany(companyId, set)
        : await org.companies.findOne({ _id: companyId }, { admins: false });

    if (!company) {
        return null;
    }

    return company.securitySettings;
}

async function updateDomainSettings(companyId, domainData) {
    const { autoJoin, ssoEnabled, ssoProvider } = domainData;

    const company = await org.companies.findOne({ _id: companyId }, { admins: false });
    if (!company) {
        throw new Error('Company not found');
    }

    if (autoJoin && !company.domainVerified) {
        throw new Error('Domain must be verified before enabling auto-join');
    }

    const sso = { enabled: ssoEnabled, provider: ssoProvider };
    const updated = await org.updateCompany(companyId, { autoJoinByDomain: autoJoin, 'settings.sso': sso });

    return {
        autoJoin,
        sso: updated.settings?.sso,
        company: org.publicCompany(updated),
    };
}

module.exports = {
    updateCompanyProfile,
    updateSecuritySettings,
    updateDomainSettings
};
