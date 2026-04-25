const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const _LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;
const User = require("../../models/User");

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
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

                
                let user = await User.findOne({ githubId: profile.id });

                if (user) {
                    return done(null, user);
                }

                
                if (email) {
                    user = await User.findOne({ email });
                    if (user) {
                        user.githubId = profile.id;
                        
                        
                        await user.save();
                        return done(null, user);
                    }
                }

                
                user = await User.create({
                    githubId: profile.id,
                    username: profile.displayName || profile.username,
                    email: email, 
                    profilePicture: profile.photos?.[0]?.value,
                    authProvider: "github",
                    passwordHash: "oauth-github-" + profile.id, 
                    verified: true
                });

                done(null, user);
            } catch (err) {
                done(err, null);
            }
        }
    )
);

module.exports = passport;
