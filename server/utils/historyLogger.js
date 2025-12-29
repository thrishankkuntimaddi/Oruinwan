// server/utils/historyLogger.js

const HistoryLog = require("../models/HistoryLog");
const logger = require("./logger");

/**
 * Log an action to history
 * @param {Object} params
 * @param {string} params.userId - User who performed action
 * @param {string} params.action - Action type (enum from HistoryLog model)
 * @param {string} params.description - Human-readable description
 * @param {string} params.resourceType - Type of resource affected
 * @param {string} params.resourceId - ID of resource affected
 * @param {string} params.companyId - Company ID (optional)
 * @param {Object} params.metadata - Additional context
 * @param {Object} params.req - Express request object (for IP/UA)
 */
exports.logAction = async ({
    userId,
    action,
    description,
    resourceType = "other",
    resourceId = null,
    companyId = null,
    metadata = {},
    req = null
}) => {
    try {
        const logEntry = new HistoryLog({
            company: companyId,
            user: userId,
            action,
            resourceType,
            resourceId,
            description,
            metadata,
            ipAddress: req ? (req.ip || req.connection.remoteAddress) : null,
            userAgent: req ? req.get("User-Agent") : null,
            timestamp: new Date()
        });

        await logEntry.save();

        logger.debug(`📝 Logged: ${action} by user ${userId}`);

        return logEntry;
    } catch (err) {
        logger.error("Error logging action:", err);
        // Don't fail the request if logging fails
    }
};

/**
 * Get user activity history
 * @param {string} userId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
exports.getUserHistory = async (userId, limit = 50) => {
    try {
        return await HistoryLog.find({ user: userId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .populate("user", "username email")
            .lean();
    } catch (err) {
        logger.error("Error fetching user history:", err);
        return [];
    }
};

/**
 * Get company activity history
 * @param {string} companyId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
exports.getCompanyHistory = async (companyId, limit = 100) => {
    try {
        return await HistoryLog.find({ company: companyId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .populate("user", "username email")
            .lean();
    } catch (err) {
        logger.error("Error fetching company history:", err);
        return [];
    }
};

/**
 * Get resource history (e.g., all actions on a workspace)
 * @param {string} resourceType
 * @param {string} resourceId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
exports.getResourceHistory = async (resourceType, resourceId, limit = 50) => {
    try {
        return await HistoryLog.find({ resourceType, resourceId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .populate("user", "username email")
            .lean();
    } catch (err) {
        logger.error("Error fetching resource history:", err);
        return [];
    }
};

module.exports = exports;
