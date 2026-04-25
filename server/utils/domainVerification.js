const dns = require("dns").promises;
const crypto = require("crypto");

exports.generateDomainVerificationToken = () => {
    
    const token = crypto.randomBytes(16).toString("hex");

    
    const txtRecord = `chttrix-verification=${token}`;

    return { token, txtRecord };
};

exports.verifyDomainTXT = async (domain, expectedToken) => {
    try {
        console.log(`🔍 Verifying domain: ${domain}`);
        console.log(`🔑 Expected token: ${expectedToken}`);

        
        const records = await dns.resolveTxt(domain);

        console.log(`📋 Found ${records.length} TXT records`);

        
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

        
        if (err.code === "ENOTFOUND") {
            console.log(`   Domain not found or has no DNS records`);
        } else if (err.code === "ENODATA") {
            console.log(`   No TXT records found for this domain`);
        }

        return false;
    }
};

exports.extractDomain = (email) => {
    const match = email.match(/@(.+)$/);
    return match ? match[1].toLowerCase() : null;
};

exports.emailMatchesDomain = (email, companyDomain) => {
    const domain = exports.extractDomain(email);
    return domain === companyDomain.toLowerCase();
};

exports.isValidDomain = (domain) => {
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
    return domainRegex.test(domain);
};

module.exports = exports;
