const User = require("../../../models/User");

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

        
        const dbUser = await User.findById(jwtPayload.sub)
            .select("companyId companyRole accountStatus username email profilePicture")
            .lean();

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
        req.companyRole = dbUser.companyRole || "member";

        
        req.user._dbUser = dbUser;

        next();
    } catch (err) {
        next(err);
    }
};

module.exports = requireCompanyMember;
