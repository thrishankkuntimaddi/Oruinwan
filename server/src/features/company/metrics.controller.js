// src/features/company/metrics.controller.js

const companyService = require("./company.service");
const metricsService = require("./metrics.service");
const Company = require("../../../models/Company");

/**
 * Get company metrics (for admin dashboard)
 * GET /api/companies/:id/metrics
 */
exports.getCompanyMetrics = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;

        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        // Check access
        const { hasAccess } = await companyService.checkUserAccess(userId, companyId);
        if (!hasAccess) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Use service layer
        const metrics = await companyService.getCompanyMetrics(companyId);

        return res.json({ metrics });

    } catch (err) {
        console.error("GET COMPANY METRICS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Get company analytics data
 * GET /api/companies/:id/analytics
 */
exports.getCompanyAnalytics = async (req, res) => {
    try {
        const { id } = req.params;

        // Use service layer
        const analytics = await metricsService.getCompanyAnalytics(id);

        return res.json(analytics);
    } catch (err) {
        console.error("GET COMPANY ANALYTICS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
