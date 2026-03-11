/**
 * avatarUtils.js
 * Deterministic avatar URL generation using DiceBear CDN.
 * No package install required — pure CDN URLs.
 *
 * Every user gets the same icon each time (seeded on their _id),
 * so avatars are stable across page reloads and devices.
 */

// Palette of warm, friendly background colours shown behind the avatar illustration
const BG_COLORS = [
  'b6e3f4', // soft blue
  'c0aede', // soft purple
  'd1d4f9', // lavender
  'ffd5dc', // blush pink
  'ffdfbf', // peach
  'c1f0c8', // mint
  'f9d8b0', // warm sand
  'ffe4a0', // sunflower
];

/**
 * Pick a background colour that is stable for a given seed string.
 * @param {string} seed
 * @returns {string} hex colour WITHOUT the #
 */
function pickBgColor(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % BG_COLORS.length;
  return BG_COLORS[index];
}

/**
 * Return the seed string to use for a user.
 * Priority: _id > id > username > email
 * @param {Object|string} user - User object or raw seed string
 * @returns {string}
 */
export function getAvatarSeed(user) {
  if (!user) return 'chttrix';
  if (typeof user === 'string') return user;
  return user._id || user.id || user.username || user.email || 'chttrix';
}

/**
 * Return a DiceBear avatar URL for a user.
 * If the user already has a real profilePicture, that is returned unchanged.
 *
 * @param {Object|string} user - User object ({ _id, username, profilePicture }) or seed string
 * @returns {string} Image URL — always non-empty
 */
export function getAvatarUrl(user) {
  // If there's already a real profile picture, use it
  if (user && typeof user === 'object' && user.profilePicture) {
    return user.profilePicture;
  }

  const seed = getAvatarSeed(user);
  const bg = pickBgColor(seed);

  // DiceBear v9 — avataaars style (friendly cartoon faces, gender-neutral options)
  // Free CDN, no API key required.
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}&radius=50`;
}

/**
 * Convenience helper: returns a DiceBear URL from a raw username string.
 * @param {string} username
 * @returns {string}
 */
export function getAvatarUrlFromUsername(username) {
  return getAvatarUrl({ username });
}

export default getAvatarUrl;
