const logger = require('../../../utils/logger');
const domainService = require("./domain.service");

exports.generateDomainVerification = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;

        const result = await domainService.generateVerification({
            companyId,
            userId,
            req
        });

        return res.json({
            message: "Domain verification token generated",
            domain: result.domain,
            txtRecord: result.txtRecord,
            expiresAt: result.expiresAt,
            instructions: result.instructions
        });

    } catch (err) {
        if (err.status && err.status < 500) {
            return res.status(err.status).json({ message: err.message });
        }
        logger.error("GENERATE DOMAIN VERIFICATION ERROR:", err);

        if (err.message === 'Company not found') {
            return res.status(404).json({ message: err.message });
        }
        if (err.message.includes('admin') || err.message.includes('owner')) {
            return res.status(403).json({ message: err.message });
        }
        if (err.message.includes('No domain')) {
            return res.status(400).json({ message: err.message });
        }

        return res.status(500).json({ message: "Server error" });
    }
};

exports.verifyDomain = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;

        const result = await domainService.verifyDomain({
            companyId,
            userId,
            req
        });

        return res.json({
            message: "Domain verified successfully",
            domain: result.domain,
            verified: true
        });

    } catch (err) {
        if (err.status && err.status < 500) {
            return res.status(err.status).json({ message: err.message });
        }
        logger.error("VERIFY DOMAIN ERROR:", err);

        if (err.message === 'Company not found') {
            return res.status(404).json({ message: err.message });
        }
        if (err.message.includes('admin') || err.message.includes('owner')) {
            return res.status(403).json({ message: err.message });
        }
        if (err.message.includes('token') || err.message.includes('expired') || err.message.includes('TXT')) {
            return res.status(400).json({ message: err.message });
        }

        return res.status(500).json({ message: "Server error" });
    }
};

exports.setAutoJoinPolicy = async (req, res) => {
    try {
        const companyId = req.params.id;
        const userId = req.user.sub;
        const { autoJoinByDomain } = req.body;

        const result = await domainService.setAutoJoinPolicy({
            companyId,
            userId,
            enabled: autoJoinByDomain,
            req
        });

        return res.json({
            message: "Auto-join policy updated",
            autoJoinByDomain: result.autoJoin
        });

    } catch (err) {
        if (err.status && err.status < 500) {
            return res.status(err.status).json({ message: err.message });
        }
        logger.error("SET AUTO-JOIN POLICY ERROR:", err);

        if (err.message === 'Company not found') {
            return res.status(404).json({ message: err.message });
        }
        if (err.message.includes('admin') || err.message.includes('owner')) {
            return res.status(403).json({ message: err.message });
        }
        if (err.message.includes('verified')) {
            return res.status(400).json({ message: err.message });
        }

        return res.status(500).json({ message: "Server error" });
    }
};
