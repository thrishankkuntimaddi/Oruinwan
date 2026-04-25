function companyQueryFilter(req, extra = {}) {
    if (!req.companyId) {
        throw new Error(
            "[companyQueryFilter] req.companyId is not set. " +
            "Ensure requireCompanyMember middleware runs before this function is called."
        );
    }

    return {
        companyId: req.companyId,
        ...extra,
    };
}

function companyFilter(req, extra = {}) {
    if (!req.companyId) {
        throw new Error(
            "[companyFilter] req.companyId is not set. " +
            "Ensure requireCompanyMember middleware runs before this function is called."
        );
    }

    return {
        company: req.companyId,
        ...extra,
    };
}

module.exports = {
    companyQueryFilter, 
    companyFilter,      
};
