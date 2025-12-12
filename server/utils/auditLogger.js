// server/utils/auditLogger.js

const AuditLog = require("../models/AuditLog");

/**
 * Comprehensive audit logging for compliance and security
 * @param {Object} params
 * @param {string} params.userId - User who performed action
 * @param {string} params.action - Action type (e.g., "user.created", "channel.deleted")
 * @param {string} params.resource - Resource type (e.g., "User", "Channel", "Workspace")
 * @param {string} params.resourceId - ID of affected resource
 * @param {string} params.companyId - Company ID (null for personal users)
 * @param {Object} params.details - Detailed information about the action
 * @param {string} params.description - Human-readable description
 * @param {Object} params.req - Express request object (for IP/UA)
 * @param {string} params.status - 'success' | 'failure' | 'pending'
 * @param {string} params.errorMessage - Error message if failed
 */
exports.logAudit = async ({
    userId,
    action,
    resource = null,
    resourceId = null,
    companyId = null,
    details = {},
    description = "",
    req = null,
    status = "success",
    errorMessage = null
}) => {
    try {
        const auditEntry = new AuditLog({
            companyId,
            userId,
            action,
            resource,
            resourceId,
            details,
            description,
            ipAddress: req ? (req.ip || req.connection?.remoteAddress || req.headers?.['x-forwarded-for']) : null,
            userAgent: req ? req.get("User-Agent") : null,
            endpoint: req ? req.originalUrl || req.url : null,
            method: req ? req.method : null,
            status,
            errorMessage
        });

        await auditEntry.save();

        const statusEmoji = status === "success" ? "✅" : status === "failure" ? "❌" : "⏳";
        console.log(`${statusEmoji} AUDIT: ${action} by user ${userId} (${status})`);

        return auditEntry;
    } catch (err) {
        console.error("❌ Error creating audit log:", err);
        // Don't fail the request if audit logging fails
    }
};

/**
 * Log successful action
 */
exports.logSuccess = (params) => {
    return exports.logAudit({ ...params, status: "success" });
};

/**
 * Log failed action
 */
exports.logFailure = (params) => {
    return exports.logAudit({ ...params, status: "failure" });
};

/**
 * Get audit logs for a company
 * @param {string} companyId
 * @param {Object} options - Query options
 * @returns {Promise<Array>}
 */
exports.getCompanyAuditLogs = async (companyId, options = {}) => {
    try {
        const {
            limit = 100,
            skip = 0,
            action = null,
            userId = null,
            startDate = null,
            endDate = null,
            status = null
        } = options;

        const query = { companyId };

        if (action) query.action = action;
        if (userId) query.userId = userId;
        if (status) query.status = status;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        return await AuditLog.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .populate("userId", "username email profilePicture")
            .lean();
    } catch (err) {
        console.error("Error fetching company audit logs:", err);
        return [];
    }
};

/**
 * Get audit logs for a specific user
 * @param {string} userId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
exports.getUserAuditLogs = async (userId, limit = 50) => {
    try {
        return await AuditLog.find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate("userId", "username email")
            .lean();
    } catch (err) {
        console.error("Error fetching user audit logs:", err);
        return [];
    }
};

/**
 * Get audit logs for a specific resource
 * @param {string} resource - Resource type
 * @param {string} resourceId - Resource ID
 * @param {number} limit
 * @returns {Promise<Array>}
 */
exports.getResourceAuditLogs = async (resource, resourceId, limit = 50) => {
    try {
        return await AuditLog.find({ resource, resourceId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate("userId", "username email")
            .lean();
    } catch (err) {
        console.error("Error fetching resource audit logs:", err);
        return [];
    }
};

/**
 * Get audit statistics for a company
 * @param {string} companyId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Object>}
 */
exports.getAuditStats = async (companyId, startDate, endDate) => {
    try {
        const query = { companyId };
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const [total, byAction, byStatus, byUser] = await Promise.all([
            // Total count
            AuditLog.countDocuments(query),

            // Count by action
            AuditLog.aggregate([
                { $match: query },
                { $group: { _id: "$action", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),

            // Count by status
            AuditLog.aggregate([
                { $match: query },
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]),

            // Top users by activity
            AuditLog.aggregate([
                { $match: query },
                { $group: { _id: "$userId", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ])
        ]);

        return {
            total,
            byAction: byAction.map(a => ({ action: a._id, count: a.count })),
            byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
            topUsers: byUser.map(u => ({ userId: u._id, count: u.count }))
        };
    } catch (err) {
        console.error("Error fetching audit stats:", err);
        return null;
    }
};

/**
 * Clean up old audit logs (for data retention compliance)
 * @param {number} days - Delete logs older than this many days
 * @returns {Promise<number>} - Number of deleted logs
 */
exports.cleanupOldLogs = async (days = 365) => {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const result = await AuditLog.deleteMany({
            createdAt: { $lt: cutoffDate }
        });

        console.log(`🗑️  Cleaned up ${result.deletedCount} audit logs older than ${days} days`);
        return result.deletedCount;
    } catch (err) {
        console.error("Error cleaning up old audit logs:", err);
        return 0;
    }
};

module.exports = exports;
