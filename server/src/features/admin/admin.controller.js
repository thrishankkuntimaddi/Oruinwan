const adminService = require('./admin.service');

function handleError(res, error) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Server error';
    return res.status(statusCode).json({ message });
}

async function getAnalyticsStats(req, res) {
    try {
        const companyId = req.user.companyId;
        const result = await adminService.getAnalyticsStats(companyId);
        return res.json(result);
    } catch (error) {
        console.error('STATS ERROR:', error);
        return handleError(res, error);
    }
}

async function getDepartments(req, res) {
    try {
        const companyId = req.user.companyId;
        const result = await adminService.getDepartments(companyId);
        return res.json(result);
    } catch (error) {
        console.error('DEPT ERROR:', error);
        return handleError(res, error);
    }
}

module.exports = {
    getAnalyticsStats,
    getDepartments
};
