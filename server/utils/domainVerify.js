// server/utils/domainVerify.js
const crypto = require("crypto");
const dns = require("dns").promises;

/**
 * generateToken
 * returns a short token suitable for DNS TXT record (alphanumeric)
 */
function generateToken() {
  // 16 hex chars (8 bytes) -> short and safe for TXT
  return crypto.randomBytes(8).toString("hex");
}

/**
 * checkDomainForToken(domain, token)
 * Resolves DNS TXT records for domain and checks if any TXT entry contains token.
 * Returns true if found.
 */
async function checkDomainForToken(domain, token) {
  if (!domain || !token) return false;

  try {
    // Try resolving TXT records for the domain and also for the _chttrix subdomain
    const candidates = [domain, `_chttrix.${domain}`];

    for (const d of candidates) {
      try {
        const records = await dns.resolveTxt(d);
        // records is array of arrays of strings
        for (const entry of records) {
          const txt = Array.isArray(entry) ? entry.join("") : String(entry);
          if (txt.includes(token)) return true;
        }
      } catch (e) {
        // ignore resolution errors on candidate domain but continue checking others
      }
    }

    return false;
  } catch (err) {
    // Unknown DNS error
    throw err;
  }
}

module.exports = { generateToken, checkDomainForToken };
