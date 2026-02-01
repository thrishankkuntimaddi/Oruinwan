// src/features/company/settings.controller.js

const settingsService = require("./settings.service");

/**
 * Update company profile
 * PUT /api/companies/:id/settings/profile
 */
exports.updateCompanyProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const profileData = req.body;

        // Use service layer
        const company = await settingsService.updateCompanyProfile(id, profileData);
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        return res.json({
            message: "Company profile updated successfully",
            company
        });
    } catch (err) {
        console.error("UPDATE COMPANY PROFILE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Update security settings
 * PUT /api/companies/:id/settings/security
 */
exports.updateSecuritySettings = async (req, res) => {
    try {
        const { id } = req.params;
        const securityData = req.body;

        // Use service layer
        const settings = await settingsService.updateSecuritySettings(id, securityData);
        if (!settings) {
            return res.status(404).json({ message: "Company not found" });
        }

        return res.json({
            message: "Security settings updated successfully",
            settings
        });
    } catch (err) {
        console.error("UPDATE SECURITY SETTINGS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Update domain & SSO settings
 * PUT /api/companies/:id/settings/domain
 */
exports.updateDomainSettings = async (req, res) => {
    try {
        const { id } = req.params;
        const domainData = req.body;

        // Use service layer
        const settings = await settingsService.updateDomainSettings(id, domainData);
        if (!settings) {
            return res.status(404).json({ message: "Company not found" });
        }

        return res.json({
            message: "Domain & SSO settings updated successfully",
            settings
        });
    } catch (err) {
        console.error("UPDATE DOMAIN SETTINGS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
