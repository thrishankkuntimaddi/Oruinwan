// server/utils/domainVerification.js

const dns = require("dns").promises;
const crypto = require("crypto");

/**
 * Generate a domain verification token
 * @returns {Object} { token, txtRecord }
 */
exports.generateDomainVerificationToken = () => {
    // Generate a short verification code
    const token = crypto.randomBytes(16).toString("hex");

    // Create the TXT record value
    const txtRecord = `chttrix-verification=${token}`;

    return { token, txtRecord };
};

/**
 * Verify domain via TXT record
 * @param {string} domain - Domain to verify (e.g., "example.com")
 * @param {string} expectedToken - Token that should be in TXT record
 * @returns {Promise<boolean>} - True if verified
 */
exports.verifyDomainTXT = async (domain, expectedToken) => {
    try {
        console.log(`🔍 Verifying domain: ${domain}`);
        console.log(`🔑 Expected token: ${expectedToken}`);

        // Query TXT records
        const records = await dns.resolveTxt(domain);

        console.log(`📋 Found ${records.length} TXT records`);

        // Flatten TXT record arrays and check for our token
        for (const record of records) {
            const txtValue = Array.isArray(record) ? record.join("") : record;
            console.log(`   - ${txtValue}`);

            if (txtValue === `chttrix-verification=${expectedToken}`) {
                console.log(`✅ Domain verified successfully!`);
                return true;
            }
        }

        console.log(`❌ Verification token not found in TXT records`);
        return false;

    } catch (err) {
        console.error(`❌ DNS lookup failed for ${domain}:`, err.message);

        // Check specific error types
        if (err.code === "ENOTFOUND") {
            console.log(`   Domain not found or has no DNS records`);
        } else if (err.code === "ENODATA") {
            console.log(`   No TXT records found for this domain`);
        }

        return false;
    }
};

/**
 * Extract domain from email
 * @param {string} email - Email address
 * @returns {string|null} - Domain or null
 */
exports.extractDomain = (email) => {
    const match = email.match(/@(.+)$/);
    return match ? match[1].toLowerCase() : null;
};

/**
 * Check if email domain matches company domain
 * @param {string} email - Email address
 * @param {string} companyDomain - Company domain
 * @returns {boolean}
 */
exports.emailMatchesDomain = (email, companyDomain) => {
    const domain = exports.extractDomain(email);
    return domain === companyDomain.toLowerCase();
};

/**
 * Validate domain format
 * @param {string} domain
 * @returns {boolean}
 */
exports.isValidDomain = (domain) => {
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
    return domainRegex.test(domain);
};

module.exports = exports;
