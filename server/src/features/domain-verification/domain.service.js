const logger = require('../../../utils/logger');
const dns = require('dns').promises;
const crypto = require('crypto');
const org = require('../../identity/queries/org');
const { logAction } = require('../../../utils/historyLogger');

// Errors carry an HTTP status so the controller never turns them into a 500.
const fail = (message, status) => Object.assign(new Error(message), { status });

function generateDomainVerificationToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const txtRecord = `chttrix-verification=${token}`;
    return { token, txtRecord };
}

async function verifyDomainTXT(domain, expectedToken) {
    try {
        const txtRecords = await dns.resolveTxt(domain);
        const expectedValue = `chttrix-verification=${expectedToken}`;

        
        for (const record of txtRecords) {
            const recordValue = Array.isArray(record) ? record.join('') : record;
            if (recordValue === expectedValue) {
                return true;
            }
        }

        return false;
    } catch (err) {
        logger.warn(`DNS lookup failed for ${domain}:`, err.code || err.message);
        // ENOTFOUND / ENODATA / timeouts: the record simply isn't visible yet.
        throw fail(`Could not find TXT records for ${domain} (${err.code || 'lookup failed'}). DNS changes can take a while to propagate — try again later.`, 400);
    }
}

async function generateVerification({ companyId }) {
    const company = await org.companies.findOne({ _id: companyId }, { admins: false });
    if (!company) {
        throw fail('Company not found', 404);
    }
    // Admin rights are checked by the route (current role from the database).

    if (!company.domain) {
        throw fail('Company domain not set. Add your domain in the company profile first.', 400);
    }

    
    const { token, txtRecord } = generateDomainVerificationToken();

    company.domainVerificationExpires = new Date(Date.now() + 86400000);
    await org.updateCompany(companyId, { domainVerificationToken: token, domainVerificationExpires: company.domainVerificationExpires, domainVerified: false });

    return {
        domain: company.domain,
        txtRecord,
        expiresAt: company.domainVerificationExpires,
        instructions: [
            `Add the following TXT record to your DNS settings for ${company.domain}:`,
            `Record Type: TXT`,
            `Host / Name: @ (or leave blank for root domain)`,
            `Value: ${txtRecord}`,
            ``,
            `After adding the DNS record, wait a few minutes for DNS propagation, then click "Verify Domain" to complete verification.`
        ]
    };
}

async function verifyDomain({ companyId, userId, req }) {
    const company = await org.companies.findOne({ _id: companyId }, { admins: false });
    if (!company) {
        throw fail('Company not found', 404);
    }
    // Admin rights are checked by the route (current role from the database).

    if (!company.domainVerificationToken || !company.domainVerificationExpires) {
        throw fail('No verification token generated. Please generate one first.', 400);
    }

    if (new Date(company.domainVerificationExpires) < new Date()) {
        throw fail('Verification token expired. Please generate a new one.', 400);
    }

    
    const verified = await verifyDomainTXT(company.domain, company.domainVerificationToken);

    if (!verified) {
        throw fail('Domain verification failed. TXT record not found or incorrect.', 400);
    }

    
    await org.updateCompany(companyId, { domainVerified: true, domainVerificationToken: null, domainVerificationExpires: null });

    
    await logAction({
        userId,
        action: 'domain_verified',
        description: `Domain ${company.domain} verified`,
        resourceType: 'company',
        resourceId: company._id,
        companyId: company._id,
        req
    });

    return {
        domain: company.domain,
        verified: true
    };
}

async function setAutoJoinPolicy({ companyId, userId, enabled, req }) {
    const company = await org.companies.findOne({ _id: companyId }, { admins: false });
    if (!company) {
        throw fail('Company not found', 404);
    }

    if (enabled && !company.domainVerified) {
        throw fail('Domain must be verified before enabling auto-join', 400);
    }

    await org.updateCompany(companyId, { autoJoinByDomain: !!enabled });

    
    await logAction({
        userId,
        action: 'auto_join_policy_changed',
        description: `Auto-join by domain ${enabled ? 'enabled' : 'disabled'}`,
        resourceType: 'company',
        resourceId: company._id,
        companyId: company._id,
        metadata: { enabled },
        req
    });

    return {
        autoJoin: company.autoJoinByDomain,
        domainVerified: company.domainVerified
    };
}

module.exports = {
    generateDomainVerificationToken,
    verifyDomainTXT,
    generateVerification,
    verifyDomain,
    setAutoJoinPolicy
};
