const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const _LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;
const User = require("../../models/User");

// Serialize user for the session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// GitHub Strategy
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

                // Try to find user by GitHub ID
                let user = await User.findOne({ githubId: profile.id });

                if (user) {
                    return done(null, user);
                }

                // If not found by ID, check email to link accounts
                if (email) {
                    user = await User.findOne({ email });
                    if (user) {
                        user.githubId = profile.id;
                        // Only update provider if it was local to signify connected account? 
                        // Or just leave it.
                        await user.save();
                        return done(null, user);
                    }
                }

                // Create new user
                user = await User.create({
                    githubId: profile.id,
                    username: profile.displayName || profile.username,
                    email: email, // If no email, this might fail validation if email is required
                    profilePicture: profile.photos?.[0]?.value,
                    authProvider: "github",
                    passwordHash: "oauth-github-" + profile.id, // Dummy password
                    verified: true
                });

                done(null, user);
            } catch (err) {
                done(err, null);
            }
        }
    )
);

// LinkedIn Strategy - REPLACED WITH MANUAL OIDC
// See routes/auth.js for the manual OpenID Connect implementation
// which uses /v2/userinfo instead of deprecated /v2/me endpoint
/*
passport.use(
    new LinkedInStrategy(
        {
            clientID: process.env.LINKEDIN_CLIENT_ID,
            clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
            callbackURL: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/linkedin/callback`,
            scope: ['openid', 'profile', 'email'],
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                console.log('LinkedIn profile received:', JSON.stringify(profile, null, 2));
                const email = profile.emails?.[0]?.value;
                const photo = profile.photos?.[0]?.value;

                let user = await User.findOne({ linkedinId: profile.id });

                if (user) {
                    return done(null, user);
                }

                if (email) {
                    user = await User.findOne({ email });
                    if (user) {
                        user.linkedinId = profile.id;
                        await user.save();
                        return done(null, user);
                    }
                }

                user = await User.create({
                    linkedinId: profile.id,
                    username: profile.displayName || `linkedin_${profile.id}`,
                    email: email,
                    profilePicture: photo,
                    authProvider: "linkedin",
                    passwordHash: "oauth-linkedin-" + profile.id,
                    verified: true
                });

                done(null, user);
            } catch (err) {
                console.error('LinkedIn OAuth error:', err);
                done(err, null);
            }
        }
    )
);
*/

module.exports = passport;
