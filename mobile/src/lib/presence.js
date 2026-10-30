// Your own presence as you see it: you're using the app, so never "offline" (away and do not
// disturb stay as you set them).
export const selfPresence = (user) => (!user?.presence || user.presence === 'offline' ? 'active' : user.presence);
