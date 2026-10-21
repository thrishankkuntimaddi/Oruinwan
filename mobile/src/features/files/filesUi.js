/** Tags as the server stores them: trimmed, lower case, no blanks or duplicates. */
export function normalizeTags(list) {
  const out = [];
  for (const raw of list || []) {
    const t = String(raw ?? '').trim().toLowerCase().replace(/^#/, '');
    if (t && !out.includes(t)) out.push(t.slice(0, 40));
  }
  return out;
}
