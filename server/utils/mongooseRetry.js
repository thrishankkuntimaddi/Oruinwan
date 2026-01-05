/**
 * Mongoose Retry Wrapper
 * Handles VersionError from concurrent document modifications
 * Implements exponential backoff and automatic retry
 */

const logger = require('./logger');

/**
 * Retry wrapper for Mongoose save operations
 * @param {Document} document - Mongoose document to save
 * @param {Object} options - Configuration options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 50)
 * @returns {Promise<Document>} Saved document
 */
async function saveWithRetry(document, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const baseDelay = options.baseDelay || 50;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            await document.save();

            if (attempt > 0) {
                logger.debug(`✅ Save succeeded after ${attempt} retries`);
            }

            return document;
        } catch (err) {
            // Only retry on VersionError
            if (err.name === 'VersionError' && attempt < maxRetries - 1) {
                const delay = baseDelay * (attempt + 1); // Exponential backoff

                logger.warn(`⚠️ VersionError on save (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, delay));

                // Reload document to get latest version
                try {
                    const Model = document.constructor;
                    const fresh = await Model.findById(document._id);

                    if (fresh) {
                        // Update version to match database
                        document.__v = fresh.__v;
                    }
                } catch (reloadErr) {
                    logger.error('Failed to reload document:', reloadErr);
                }

                continue; // Retry
            }

            // Not a VersionError or max retries exceeded
            if (err.name === 'VersionError') {
                logger.error(`❌ VersionError persisted after ${maxRetries} attempts`);
            }

            throw err;
        }
    }

    throw new Error('Save failed after maximum retries');
}

/**
 * Retry wrapper for create operations
 * @param {Model} Model - Mongoose model
 * @param {Object} data - Document data
 * @param {Object} options - Configuration options
 * @returns {Promise<Document>} Created document
 */
async function createWithRetry(Model, data, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const baseDelay = options.baseDelay || 50;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const doc = await Model.create(data);

            if (attempt > 0) {
                logger.debug(`✅ Create succeeded after ${attempt} retries`);
            }

            return doc;
        } catch (err) {
            // Retry on duplicate key errors (race condition)
            if (err.code === 11000 && attempt < maxRetries - 1) {
                const delay = baseDelay * (attempt + 1);
                logger.warn(`⚠️ Duplicate key error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            throw err;
        }
    }

    throw new Error('Create failed after maximum retries');
}

/**
 * Wrapper for findByIdAndUpdate with retry logic
 * @param {Model} Model - Mongoose model
 * @param {string} id - Document ID
 * @param {Object} update - Update operations
 * @param {Object} options - Mongoose options + retry options
 * @returns {Promise<Document>} Updated document
 */
async function updateWithRetry(Model, id, update, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const baseDelay = options.baseDelay || 50;
    const mongooseOptions = { ...options };
    delete mongooseOptions.maxRetries;
    delete mongooseOptions.baseDelay;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const doc = await Model.findByIdAndUpdate(id, update, mongooseOptions);

            if (attempt > 0) {
                logger.debug(`✅ Update succeeded after ${attempt} retries`);
            }

            return doc;
        } catch (err) {
            if (err.name === 'VersionError' && attempt < maxRetries - 1) {
                const delay = baseDelay * (attempt + 1);
                logger.warn(`⚠️ VersionError on update (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            throw err;
        }
    }

    throw new Error('Update failed after maximum retries');
}

module.exports = {
    saveWithRetry,
    createWithRetry,
    updateWithRetry
};
