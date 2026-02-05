/**
 * Domain Verification Service - DNS-based Domain Ownership Verification
 * 
 * Handles domain verification via DNS TXT records, token generation,
 * and auto-join policy management.
 * Extracted from companyController.js for better separation of concerns.
 * 
 * @module features/domain-verification/domain.service
 */

const dns = require('dns').promises;
const crypto = require('crypto');
const Company = require('../../../models/Company');
const { logAction } = require('../../../utils/historyLogger');

/**
 * Generate domain verification token and TXT record
 * @returns {{token: string, txtRecord: string}} Token and DNS TXT record value
 */
function generateDomainVerificationToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const txtRecord = `chttrix-verification=${token}`;
    return { token, txtRecord };
}

/**
 * Verify domain ownership via DNS TXT record
 * @param {string} domain - Domain to verify
 * @param {string} expectedToken - Expected verification token
 * @returns {Promise<boolean>} True if verified, false otherwise
 */
async function verifyDomainTXT(domain, expectedToken) {
    try {
        const txtRecords = await dns.resolveTxt(domain);
        const expectedValue = `chttrix-verification=${expectedToken}`;

        // Check if any TXT record matches
        for (const record of txtRecords) {
            const recordValue = Array.isArray(record) ? record.join('') : record;
            if (recordValue === expectedValue) {
                return true;
            }
        }

        return false;
    } catch (_err) {
        console.error(`DNS lookup failed for ${domain}:`, err.message);
        return false;
    }
}

/**
 * Generate domain verification token for company
 * @param {Object} params - Parameters
 * @returns {Promise<Object>} Verification details
 */
async function generateVerification({ companyId, userId }) {
    const company = await Company.findById(companyId);
    if (!company) {
        throw new Error('Company not found');
    }

    if (!company.isAdmin(userId)) {
        throw new Error('Only company admins can verify domain');
    }

    if (!company.domain) {
        throw new Error('Company domain not set');
    }

    // Generate token
    const { token, txtRecord } = generateDomainVerificationToken();

    company.domainVerificationToken = token;
    company.domainVerificationExpires = new Date(Date.now() + 86400000); // 24 hours
    company.domainVerified = false;
    await company.save();

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

/**
 * Verify domain ownership
 * @param {Object} params - Parameters
 * @returns {Promise<Object>} Verification result
 */
async function verifyDomain({ companyId, userId, req }) {
    const company = await Company.findById(companyId);
    if (!company) {
        throw new Error('Company not found');
    }

    if (!company.isAdmin(userId)) {
        throw new Error('Only company admins can verify domain');
    }

    if (!company.domainVerificationToken || !company.domainVerificationExpires) {
        throw new Error('No verification token generated. Please generate one first.');
    }

    if (company.domainVerificationExpires < new Date()) {
        throw new Error('Verification token expired. Please generate a new one.');
    }

    // Verify DNS TXT record
    const verified = await verifyDomainTXT(company.domain, company.domainVerificationToken);

    if (!verified) {
        throw new Error('Domain verification failed. TXT record not found or incorrect.');
    }

    // Mark as verified
    company.domainVerified = true;
    company.domainVerificationToken = null;
    company.domainVerificationExpires = null;
    await company.save();

    // Log verification
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

/**
 * Set auto-join policy for domain
 * @param {Object} params - Parameters
 * @returns {Promise<Object>} Updated policy
 */
async function setAutoJoinPolicy({ companyId, userId, enabled, req }) {
    const company = await Company.findById(companyId);
    if (!company) {
        throw new Error('Company not found');
    }

    if (!company.isAdmin(userId)) {
        throw new Error('Only company admins can change auto-join policy');
    }

    if (enabled && !company.domainVerified) {
        throw new Error('Domain must be verified before enabling auto-join');
    }

    company.autoJoinByDomain = enabled;
    await company.save();

    // Log change
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

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
    generateDomainVerificationToken,
    verifyDomainTXT,
    generateVerification,
    verifyDomain,
    setAutoJoinPolicy
};
