'use strict';

/**
 * After requireCompanyMember: the company in the URL (req.params[param]) must
 * be the caller's own company, otherwise 403.
 */
function requireOwnCompany(param = 'id') {
    return (req, res, next) => {
        if (!req.companyId || String(req.params[param]) !== String(req.companyId)) {
            return res.status(403).json({ success: false, message: 'Access denied: that company is not yours', code: 'COMPANY_MISMATCH' });
        }
        next();
    };
}

module.exports = requireOwnCompany;
