function getActiveKEKVersion() {
    const version = parseInt(process.env.CRYPTO_KEK_ACTIVE_VERSION || '1');
    return version;
}

function getKEKByVersion(version) {
    const kekHex = process.env[`CRYPTO_KEK_V${version}`];

    if (!kekHex) {
        
        if (version === 1 && process.env.SERVER_CRYPTO_KEK) {
            const legacyKey = Buffer.from(process.env.SERVER_CRYPTO_KEK, 'utf-8').slice(0, 32);
            if (legacyKey.length !== 32) {
                throw new Error(`Invalid KEK V${version} length: expected 32 bytes, got ${legacyKey.length}`);
            }
            return legacyKey;
        }

        throw new Error(`KEK version ${version} not found in environment`);
    }

    
    const key = Buffer.from(kekHex, 'hex');

    if (key.length !== 32) {
        throw new Error(`Invalid KEK V${version} length: expected 32 bytes, got ${key.length} (hex string may be malformed)`);
    }

    return key;
}

exports.getActiveKEK = () => {
    const version = getActiveKEKVersion();
    const key = getKEKByVersion(version);

    return { version, key };
};

exports.getKEKForUnwrap = (version) => {
    return getKEKByVersion(version);
};

exports.kekVersionExists = (version) => {
    try {
        getKEKByVersion(version);
        return true;
    } catch (error) {
        return false;
    }
};

exports.listAvailableKEKVersions = () => {
    const versions = [];

    
    if (process.env.SERVER_CRYPTO_KEK) {
        versions.push(1);
    }

    
    for (let i = 1; i <= 10; i++) {  
        if (process.env[`CRYPTO_KEK_V${i}`]) {
            if (!versions.includes(i)) {
                versions.push(i);
            }
        }
    }

    return versions.sort((a, b) => a - b);
};

module.exports = exports;
