const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const _LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;
// Users live in PostgreSQL; userDocs gives the mutable document the strategies update.
const { userDocs } = require("../src/identity/queries/auth");

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await userDocs.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(
    new GitHubStrategy(
        {
            clientID: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            callbackURL: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/github/callback`
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;

                
                let user = await userDocs.findByProvider('github', profile.id);

                if (user) {
                    return done(null, user);
                }

                
                // Auto-link to an existing account only when BOTH sides have a verified email:
                // the local account must be verified and GitHub must not mark the address unverified.
                // Otherwise an attacker could pre-register (or add on GitHub) a victim's email and
                // take over the account.
                const githubEmailVerified = profile.emails?.[0]?.verified !== false;
                if (email) {
                    user = await userDocs.findByEmail(email);
                    if (user) {
                        if (!user.verified || !githubEmailVerified || user.githubId) {
                            return done(null, false, { message: "An account with this email already exists. Sign in with your password and link GitHub from settings." });
                        }
                        user.githubId = profile.id;
                        await user.save();
                        return done(null, user);
                    }
                }

                
                user = await userDocs.create({
                    githubId: profile.id,
                    username: profile.displayName || profile.username,
                    email: email, 
                    profilePicture: profile.photos?.[0]?.value,
                    authProvider: "github",
                    passwordHash: "oauth-github-" + profile.id, 
                    verified: true,
                    passwordSetAt: null,  
                    passwordLoginEnabled: false  
                });

                done(null, user);
            } catch (err) {
                done(err, null);
            }
        }
    )
);

module.exports = passport;
