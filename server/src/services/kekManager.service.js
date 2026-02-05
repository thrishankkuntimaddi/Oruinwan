// server/src/services/kekManager.service.js

/**
 * KEK Manager Service
 * 
 * PHASE 4D: Server KEK versioning and rotation
 * 
 * Purpose:
 * - Manage multiple KEK versions
 * - Support safe KEK rotation
 * - Preserve backward compatibility
 * 
 * CRITICAL:
 * - KEKs protect UMEK for OAuth users ONLY
 * - Server never decrypts identity private keys
 * - Password users are NOT affected
 */

/**
 * Get active KEK version from environment
 * @returns {number}
 */
function getActiveKEKVersion() {
    const version = parseInt(process.env.CRYPTO_KEK_ACTIVE_VERSION || '1');
    return version;
}

/**
 * Get KEK by version
 * @param {number} version - KEK version
 * @returns {Buffer}
 */
function getKEKByVersion(version) {
    const kekHex = process.env[`CRYPTO_KEK_V${version}`];

    if (!kekHex) {
        // Fallback to legacy SERVER_CRYPTO_KEK for version 1
        if (version === 1 && process.env.SERVER_CRYPTO_KEK) {
            const legacyKey = Buffer.from(process.env.SERVER_CRYPTO_KEK, 'utf-8').slice(0, 32);
            if (legacyKey.length !== 32) {
                throw new Error(`Invalid KEK V${version} length: expected 32 bytes, got ${legacyKey.length}`);
            }
            return legacyKey;
        }

        throw new Error(`KEK version ${version} not found in environment`);
    }

    // KEK should be hex-encoded (64 hex chars = 32 bytes)
    const key = Buffer.from(kekHex, 'hex');

    if (key.length !== 32) {
        throw new Error(`Invalid KEK V${version} length: expected 32 bytes, got ${key.length} (hex string may be malformed)`);
    }

    return key;
}

/**
 * Get active KEK (for new wraps)
 * @returns {{ version: number, key: Buffer }}
 */
exports.getActiveKEK = () => {
    const version = getActiveKEKVersion();
    const key = getKEKByVersion(version);

    return { version, key };
};

/**
 * Get KEK for unwrapping (by version)
 * @param {number} version - KEK version
 * @returns {Buffer}
 */
exports.getKEKForUnwrap = (version) => {
    return getKEKByVersion(version);
};

/**
 * Check if KEK version exists
 * @param {number} version - KEK version
 * @returns {boolean}
 */
exports.kekVersionExists = (version) => {
    try {
        getKEKByVersion(version);
        return true;
    } catch (_error) {
        return false;
    }
};

/**
 * List all available KEK versions
 * @returns {number[]}
 */
exports.listAvailableKEKVersions = () => {
    const versions = [];

    // Check for legacy KEK
    if (process.env.SERVER_CRYPTO_KEK) {
        versions.push(1);
    }

    // Check for versioned KEKs
    for (let i = 1; i <= 10; i++) {  // Check up to v10
        if (process.env[`CRYPTO_KEK_V${i}`]) {
            if (!versions.includes(i)) {
                versions.push(i);
            }
        }
    }

    return versions.sort((a, b) => a - b);
};

module.exports = exports;
