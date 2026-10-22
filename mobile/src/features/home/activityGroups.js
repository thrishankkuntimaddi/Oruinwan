// Chat notifications fold into one row per conversation ("Ben · 5 new messages"). The server
// groups new ones (meta.count); this also folds older rows saved one per message.
const CHAT_KINDS = new Set(['dm', 'mention', 'thread']);

function groupKey(n) {
  if (!CHAT_KINDS.has(n.type) || !n.target) return null;
  const t = n.target;
  const where = t.conv ? `${t.convKind}:${t.conv}:${t.id}` : `${t.kind}:${t.id}`;
  return `${n.type}|${where}|${n.read ? 'read' : 'unread'}`;
}

/** Folds rows of the same chat (and the same read state) into the newest one, summing counts. */
export function groupActivity(list = []) {
  const out = [];
  const byKey = new Map();
  const sorted = [...list].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  for (const n of sorted) {
    const key = groupKey(n);
    const first = key ? byKey.get(key) : null;
    if (first) {
      first.count += n.count || 1;
      continue;
    }
    const row = { ...n, count: n.count || 1 };
    if (key) byKey.set(key, row);
    out.push(row);
  }
  return out;
}
