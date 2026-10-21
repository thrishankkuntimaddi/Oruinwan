// Roadmap helpers: quarters, grouping and the wide timeline's geometry. No React here.

export const STATUS_META = {
  planned: { label: 'Planned', tone: 'text-text-2', dot: 'bg-text-3' },
  in_progress: { label: 'In progress', tone: 'text-info', dot: 'bg-info' },
  at_risk: { label: 'At risk', tone: 'text-warning', dot: 'bg-warning' },
  done: { label: 'Done', tone: 'text-success', dot: 'bg-success' },
};

/** Item colour (a theme token name from the server) → a CSS colour from the app's own tokens. */
export const COLOR_VAR = {
  accent: 'var(--color-accent)',
  'color-primary': 'var(--color-accent-strong)',
  'color-success': 'var(--color-success)',
  'color-warning': 'var(--color-warning)',
  'color-danger': 'var(--color-danger)',
  'text-muted': 'var(--color-text-3)',
};
export const COLOR_LABEL = { accent: 'Gold', 'color-primary': 'Bronze', 'color-success': 'Green', 'color-warning': 'Amber', 'color-danger': 'Red', 'text-muted': 'Grey' };
export const colorOf = (c) => COLOR_VAR[c] || COLOR_VAR.accent;

const QUARTER_RE = /^(\d{4})-Q([1-4])$/;

/** 'YYYY-Qn' for a date (UTC, like the server); null for no / bad date. */
export function quarterOf(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

/** The quarter an item belongs to: its own `quarter`, else from its start, else its end. */
export const itemQuarter = (item) => (QUARTER_RE.test(item?.quarter || '') ? item.quarter : quarterOf(item?.start) || quarterOf(item?.end));

/** 'Q4 2026' */
export function quarterLabel(q) {
  const m = QUARTER_RE.exec(q || '');
  return m ? `Q${m[2]} ${m[1]}` : 'No quarter';
}

/** [startMs, endMs) of a quarter key. */
export function quarterRange(q) {
  const m = QUARTER_RE.exec(q || '');
  if (!m) return null;
  const y = Number(m[1]);
  const s = (Number(m[2]) - 1) * 3;
  return [Date.UTC(y, s, 1), Date.UTC(y, s + 3, 1)];
}

/** Next quarter key ('2026-Q4' → '2027-Q1'). */
export function nextQuarter(q) {
  const m = QUARTER_RE.exec(q);
  if (!m) return null;
  const y = Number(m[1]);
  const n = Number(m[2]);
  return n === 4 ? `${y + 1}-Q1` : `${y}-Q${n + 1}`;
}

/** Quarter choices for the editor: last quarter through the next 6. */
export function quarterOptions(now = Date.now()) {
  let q = quarterOf(new Date(now - 92 * 86_400_000));
  const out = [];
  for (let i = 0; i < 8; i += 1) {
    out.push(q);
    q = nextQuarter(q);
  }
  return out;
}

/**
 * Items grouped by quarter, quarters in time order, unscheduled last; inside a quarter by
 * lane order then start date.
 */
export function groupByQuarter(items) {
  const groups = new Map();
  for (const it of items || []) {
    const q = itemQuarter(it) || '';
    if (!groups.has(q)) groups.set(q, []);
    groups.get(q).push(it);
  }
  const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.start || '').localeCompare(String(b.start || ''));
  return [...groups.entries()]
    .sort(([a], [b]) => (!a ? 1 : !b ? -1 : a.localeCompare(b)))
    .map(([quarter, list]) => ({ quarter: quarter || null, label: quarterLabel(quarter), items: list.slice().sort(byOrder) }));
}

/** An item's span in ms: its dates, else its quarter; null when it has neither. */
export function itemSpan(item) {
  const s = item?.start ? Date.parse(item.start) : NaN;
  const e = item?.end ? Date.parse(item.end) : NaN;
  if (Number.isFinite(s) && Number.isFinite(e)) return [s, Math.max(e, s) + 86_400_000];
  const q = quarterRange(itemQuarter(item));
  if (Number.isFinite(s)) return [s, Math.max(s + 86_400_000, q ? q[1] : s + 14 * 86_400_000)];
  if (Number.isFinite(e)) return [Math.min(e, q ? q[0] : e - 14 * 86_400_000), e + 86_400_000];
  return q;
}

/**
 * The horizontal timeline: whole quarters from the earliest to the latest item (at least two),
 * each item placed by percent. Items without any date land in `unscheduled`.
 */
export function timelineLayout(items, now = Date.now()) {
  const placed = [];
  const unscheduled = [];
  for (const it of items || []) {
    const span = itemSpan(it);
    if (span) placed.push({ item: it, span });
    else unscheduled.push(it);
  }
  let first = quarterOf(now);
  let last = first;
  for (const { span } of placed) {
    const a = quarterOf(span[0]);
    const b = quarterOf(span[1] - 1);
    if (a < first) first = a;
    if (b > last) last = b;
  }
  const quarters = [first];
  while (quarters[quarters.length - 1] !== last && quarters.length < 24) quarters.push(nextQuarter(quarters[quarters.length - 1]));
  if (quarters.length < 2) quarters.push(nextQuarter(last));
  const from = quarterRange(quarters[0])[0];
  const to = quarterRange(quarters[quarters.length - 1])[1];
  const pct = (t) => Math.max(0, Math.min(100, ((t - from) / (to - from)) * 100));
  const rows = placed
    .sort((a, b) => a.span[0] - b.span[0] || (a.item.order ?? 0) - (b.item.order ?? 0))
    .map(({ item, span }) => {
      const left = pct(span[0]);
      return { item, left, width: Math.max(pct(span[1]) - left, 1.5) };
    });
  return {
    quarters: quarters.map((q) => ({ key: q, label: quarterLabel(q), width: ((quarterRange(q)[1] - quarterRange(q)[0]) / (to - from)) * 100 })),
    rows,
    unscheduled,
    today: now >= from && now < to ? pct(now) : null,
  };
}

/**
 * What the viewer may do with an item. `manager` = the list's `canCreate` (workspace owner/admin or
 * company owner/admin/manager). Edit: managers, the owner, the creator (the server's `canEdit`).
 * Delete: managers or the creator. Changing the owner: managers only.
 */
export function roadmapPermissions(item, { manager = false, me = null } = {}) {
  const creator = Boolean(me && item?.createdById === me);
  return {
    edit: Boolean(item?.canEdit || manager || creator || (me && item?.ownerId === me)),
    remove: manager || creator,
    changeOwner: manager,
  };
}
