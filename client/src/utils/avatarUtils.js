const BG_COLORS = [
  'b6e3f4', 
  'c0aede', 
  'd1d4f9', 
  'ffd5dc', 
  'ffdfbf', 
  'c1f0c8', 
  'f9d8b0', 
  'ffe4a0', 
];

function pickBgColor(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % BG_COLORS.length;
  return BG_COLORS[index];
}

export function getAvatarSeed(user) {
  if (!user) return 'chttrix';
  if (typeof user === 'string') return user;
  return user._id || user.id || user.username || user.email || 'chttrix';
}

export function getAvatarUrl(user) {
  
  if (user && typeof user === 'object' && user.profilePicture) {
    return user.profilePicture;
  }

  const seed = getAvatarSeed(user);
  const bg = pickBgColor(seed);

  
  
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}&radius=50`;
}

export function getAvatarUrlFromUsername(username) {
  return getAvatarUrl({ username });
}

export default getAvatarUrl;
