const HistoryLog = require("../models/HistoryLog");
const User = require("../models/User");

// Get audit logs for a company
exports.getCompanyAuditLogs = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { page = 1, limit = 20, userId, action, startDate, endDate } = req.query;

        // Build filter
        const query = { company: companyId };

        if (userId) query.user = userId;
        if (action) query.action = action;

        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        // Execute query with pagination
        const logs = await HistoryLog.find(query)
            .sort({ timestamp: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('user', 'username email profilePicture')
            .lean();

        const total = await HistoryLog.countDocuments(query);

        res.json({
            logs,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get Audit Logs Error:', error);
        res.status(500).json({ message: 'Server error fetching audit logs' });
    }
};

// Export audit logs (basic CSV support)
exports.exportAuditLogs = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { format } = req.query;

        const logs = await HistoryLog.find({ company: companyId })
            .sort({ timestamp: -1 })
            .populate('user', 'username email')
            .lean();

        if (format === 'csv') {
            const fields = ['Timestamp', 'User', 'Action', 'Description', 'IP Address'];
            const rows = logs.map(log => [
                new Date(log.timestamp).toISOString(),
                log.user?.username || 'System',
                log.action,
                `"${log.description}"`, // Escape quotes
                log.ipAddress || ''
            ]);

            const csvContent = [
                fields.join(','),
                ...rows.map(r => r.join(','))
            ].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${companyId}.csv`);
            return res.send(csvContent);
        }

        res.json(logs); // Default JSON

    } catch (error) {
        console.error('Export Audit Logs Error:', error);
        res.status(500).json({ message: 'Server error exporting logs' });
    }
};
