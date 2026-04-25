const companyService = require("./company.service");
const metricsService = require("./metrics.service");
const Company = require("../../../models/Company");

exports.getCompanyMetrics = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;

        const company = await Company.findById(companyId);
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
        console.error("GET COMPANY METRICS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.getCompanyAnalytics = async (req, res) => {
    try {
        const { id } = req.params;

        
        const analytics = await metricsService.getCompanyAnalytics(id);

        return res.json(analytics);
    } catch (err) {
        console.error("GET COMPANY ANALYTICS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
