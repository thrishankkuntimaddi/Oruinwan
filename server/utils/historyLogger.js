const HistoryLog = require("../models/HistoryLog");
const logger = require("./logger");

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
        
    }
};

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
