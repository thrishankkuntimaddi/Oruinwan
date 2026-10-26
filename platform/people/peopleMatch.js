// Matching people by what someone types — one rule for the web app, the desktop app and the
// phone app (New message, group pickers, @mentions, call invites, quick search).
//
//   0  the name starts with it                    "ma"    → "Manideep K"
//   1  a word of the name starts with it,         "ma"    → "Ana Martin"
//      or every typed word starts a name word     "sh ku" → "Shiva Kumar"
//   2  the username starts with it (@ optional)   "@mani" → mani
//   3  the email starts with it                   "tk"    → tk@x.io
//   4  3+ letters anywhere in name/username/email "deep"  → "Manideep K"
//
// Short queries only match word starts, so "ma" never finds "Shiva Kumar". Case, accents and
// surrounding spaces don't matter. People without a name are matched by their username.

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');

/** 0 = best match, higher = weaker, -1 = no match. */
export function personMatchRank(user, query) {
  const q = norm(query).trim().replace(/\s+/g, ' ');
  if (!q) return 0;
  const name = norm(user?.name || user?.displayName || user?.username);
  const username = norm(user?.username);
  const email = norm(user?.email);
  if (name.startsWith(q)) return 0;
  const words = name.split(/[\s._-]+/).filter(Boolean);
  if (words.some((w) => w.startsWith(q))) return 1;
  const parts = q.split(' ');
  if (parts.length > 1 && parts.every((p) => words.some((w) => w.startsWith(p)))) return 1;
  const handle = q.replace(/^@/, '');
  if (handle && username.startsWith(handle)) return 2;
  if (email && email.startsWith(q)) return 3;
  if (q.length >= 3 && [name, username, email].some((h) => h.includes(q))) return 4;
  return -1;
}

export const matchesPerson = (user, query) => personMatchRank(user, query) >= 0;

/** People matching the query, best matches first, then by name. */
export function searchPeople(list, query) {
  return (list || [])
    .map((u) => [u, personMatchRank(u, query)])
    .filter(([, r]) => r >= 0)
    .sort((a, b) => a[1] - b[1] || norm(a[0].name || a[0].username).localeCompare(norm(b[0].name || b[0].username)))
    .map(([u]) => u);
}

/** Generic text match for channel names, titles: start of the text or of any word in it. */
export function wordStartMatch(text, query) {
  const q = norm(query).trim();
  if (!q) return true;
  const t = norm(text);
  if (t.startsWith(q)) return true;
  return t.split(/[\s#._/-]+/).some((w) => w.startsWith(q)) || (q.length >= 3 && t.includes(q));
}
