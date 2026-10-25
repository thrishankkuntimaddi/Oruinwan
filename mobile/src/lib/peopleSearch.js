// Matching people by what someone types: the start of any word in their name, their username or
// the start of their email. "ma" finds "Manideep" and "Ana Martin", never "Shiva Kumar".
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');

/** 0 = best match, higher = weaker, -1 = no match. */
export function personMatchRank(user, query) {
  const q = norm(query).trim();
  if (!q) return 0;
  const name = norm(user?.name);
  if (name.startsWith(q)) return 0;
  const words = name.split(/[\s._-]+/).filter(Boolean);
  if (words.some((w) => w.startsWith(q))) return 1;
  // "ma ku" → one word starts with "ma", another with "ku".
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => words.some((w) => w.startsWith(p)))) return 1;
  const handle = q.replace(/^@/, '');
  if (handle && norm(user?.username).startsWith(handle)) return 2;
  if (norm(user?.email).split('@')[0].startsWith(q)) return 3;
  return -1;
}

export const matchesPerson = (user, query) => personMatchRank(user, query) >= 0;

/** People matching the query, best matches first, then by name. */
export function searchPeople(list, query) {
  return (list || [])
    .map((u) => [u, personMatchRank(u, query)])
    .filter(([, r]) => r >= 0)
    .sort((a, b) => a[1] - b[1] || norm(a[0].name).localeCompare(norm(b[0].name)))
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
