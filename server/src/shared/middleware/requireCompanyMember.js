// server/src/shared/middleware/requireCompanyMember.js
//
// ARCH: Gate #1 in the middleware chain. MUST run after verifyToken (requireAuth).
// Every company-scoped API route must pass this middleware FIRST.
//
// Phase 1 upgrade: does ONE User.findById DB read so that companyId and
// accountStatus are read from the database — not from the JWT payload (which
// only carries { sub, roles } and cannot be trusted for these fields).
//
// Checks:
//   1. User is authenticated (req.user set by verifyToken)
//   2. User exists in DB and has accountStatus === 'active'
//   3. User.companyId exists (belongs to a company)
//
// Sets on req:
//   req.companyId      → the user's company ObjectId (string)
//   req.companyRole    → the user's company-level role string
//   req.user._dbUser   → full Mongoose user document (lean)
//                        allows downstream middleware/controllers to skip
//                        a second DB round-trip

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

        // Single DB read — fetches companyId and accountStatus which are NOT in JWT
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

        // Account must be active (not suspended, invited, deactivated, removed)
        if (dbUser.accountStatus !== "active") {
            return res.status(403).json({
                success: false,
                error: "Your account is not active. Please contact your administrator.",
                code: "ACCOUNT_INACTIVE",
                status: dbUser.accountStatus,
            });
        }

        // User must belong to a company
        if (!dbUser.companyId) {
            return res.status(403).json({
                success: false,
                error: "You are not associated with a company.",
                code: "NO_COMPANY",
            });
        }

        // Attach company context to req — available to all downstream middleware and controllers
        req.companyId = dbUser.companyId.toString();
        req.companyRole = dbUser.companyRole || "member";

        // Attach the loaded user doc so downstream handlers don't need to re-query
        req.user._dbUser = dbUser;

        next();
    } catch (err) {
        next(err);
    }
};

module.exports = requireCompanyMember;

