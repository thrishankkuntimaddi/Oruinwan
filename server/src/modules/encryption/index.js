// server/src/modules/encryption/index.js
/**
 * Encryption Module - Public API
 * 
 * Central export point for encryption module
 */

const encryptionService = require('./encryption.service');
const encryptionController = require('./encryption.controller');
const encryptionRoutes = require('./encryption.routes');

module.exports = {
    service: encryptionService,
    controller: encryptionController,
    routes: encryptionRoutes
};
