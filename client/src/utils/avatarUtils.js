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

// Every user gets a stored profilePicture at sign-up, but some payloads (socket
// events, thread parents, name-only props) arrive without it. Remember each
// picture we see, keyed by id and by username, so every screen shows the same
// avatar for the same person instead of a generated fallback.
const knownPictures = new Map();

const idKey = (id) => (id ? `id:${String(id)}` : null);
const nameKey = (name) => (name ? `name:${String(name).trim().toLowerCase()}` : null);

function userId(user) {
  const id = user?._id || user?.id;
  return id && typeof id === 'object' && id.toString ? id.toString() : id;
}

/** Record a user's stored picture so later lookups by id or username find it. */
export function rememberAvatar(user) {
  if (!user || typeof user !== 'object' || !user.profilePicture) return;
  for (const key of [idKey(userId(user)), nameKey(user.username)]) {
    if (key) knownPictures.set(key, user.profilePicture);
  }
}

/** Remember every user in a list (members, participants...). */
export function rememberAvatars(users) {
  (users || []).forEach((u) => rememberAvatar(u?.user && typeof u.user === 'object' ? u.user : u));
}

function knownPicture(user) {
  if (typeof user === 'string') {
    return knownPictures.get(idKey(user)) || knownPictures.get(nameKey(user)) || null;
  }
  return knownPictures.get(idKey(userId(user))) || knownPictures.get(nameKey(user?.username)) || null;
}

/**
 * The seed for a generated avatar. Username first: it is the one field every
 * caller has (some only get a name), so the same person always gets the same face.
 */
export function getAvatarSeed(user) {
  if (!user) return 'chttrix';
  if (typeof user === 'string') return user.trim().toLowerCase();
  const seed = user.username || user.email?.split('@')[0] || userId(user) || 'chttrix';
  return String(seed).trim().toLowerCase();
}

export function getAvatarUrl(user) {
  if (user && typeof user === 'object' && user.profilePicture) {
    rememberAvatar(user);
    return user.profilePicture;
  }

  const known = knownPicture(user);
  if (known) return known;

  const seed = getAvatarSeed(user);
  const bg = pickBgColor(seed);
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}&radius=50`;
}

export function getAvatarUrlFromUsername(username) {
  return getAvatarUrl({ username });
}

export function __resetAvatarCacheForTests() {
  knownPictures.clear();
}

export default getAvatarUrl;
