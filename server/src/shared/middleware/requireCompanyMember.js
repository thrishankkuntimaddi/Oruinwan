const { loadAuthUser } = require("../../identity/queries/auth");

const requireCompanyMember = async (req, res, next) => {
    try {
        const jwtPayload = req.user;

        if (!jwtPayload || !jwtPayload.sub) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized",
                code: "AUTH_REQUIRED",
            });
        }

        
        const dbUser = await loadAuthUser(jwtPayload.sub);

        if (!dbUser) {
            return res.status(401).json({
                success: false,
                error: "User not found.",
                code: "USER_NOT_FOUND",
            });
        }

        
        if (dbUser.accountStatus !== "active") {
            return res.status(403).json({
                success: false,
                error: "Your account is not active. Please contact your administrator.",
                code: "ACCOUNT_INACTIVE",
                status: dbUser.accountStatus,
            });
        }

        
        if (!dbUser.companyId) {
            return res.status(403).json({
                success: false,
                error: "You are not associated with a company.",
                code: "NO_COMPANY",
            });
        }

        
        req.companyId = dbUser.companyId.toString();
        // A co-owner of this company acts with owner rights.
        const isCoOwner = !!(dbUser.coOwnerOf && String(dbUser.coOwnerOf) === String(dbUser.companyId));
        req.isCoOwner = isCoOwner;
        req.companyRole = isCoOwner ? "owner" : (dbUser.companyRole || "member");

        
        req.user._dbUser = dbUser;

        next();
    } catch (err) {
        next(err);
    }
};

module.exports = requireCompanyMember;
