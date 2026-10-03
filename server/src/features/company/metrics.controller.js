const logger = require('../../../utils/logger');
const companyService = require("./company.service");
const metricsService = require("./metrics.service");
const org = require("../../identity/queries/org");

exports.getCompanyMetrics = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;

        const company = await org.companies.findOne({ _id: companyId }, { admins: false });
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        
        const { hasAccess } = await companyService.checkUserAccess(userId, companyId);
        if (!hasAccess) {
            return res.status(403).json({ message: "Access denied" });
        }

        
        const metrics = await companyService.getCompanyMetrics(companyId);

        return res.json({ metrics });

    } catch (err) {
        logger.error("GET COMPANY METRICS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.getCompanyAnalytics = async (req, res) => {
    try {
        const { id } = req.params;

        
        const analytics = await metricsService.getCompanyAnalytics(id);

        return res.json(analytics);
    } catch (err) {
        logger.error("GET COMPANY ANALYTICS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
