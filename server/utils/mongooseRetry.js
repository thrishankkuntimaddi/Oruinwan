const logger = require('./logger');

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
            
            if (err.name === 'VersionError' && attempt < maxRetries - 1) {
                const delay = baseDelay * (attempt + 1); 

                logger.warn(`⚠️ VersionError on save (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);

                
                await new Promise(resolve => setTimeout(resolve, delay));

                
                try {
                    const Model = document.constructor;
                    const fresh = await Model.findById(document._id);

                    if (fresh) {
                        
                        document.__v = fresh.__v;
                    }
                } catch (reloadErr) {
                    logger.error('Failed to reload document:', reloadErr);
                }

                continue; 
            }

            
            if (err.name === 'VersionError') {
                logger.error(`❌ VersionError persisted after ${maxRetries} attempts`);
            }

            throw err;
        }
    }

    throw new Error('Save failed after maximum retries');
}

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
