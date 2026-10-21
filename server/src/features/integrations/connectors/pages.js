'use strict';

/**
 * Wiki connectors: Notion (internal integration secret) and Confluence Cloud
 * (account e-mail + API token). Both offer `search`, `item` and `import`
 * (copy a page into Oruinwan Knowledge as Markdown, with a link back).
 */

const { request, normalizeHttpsUrl, clip, httpError } = require('./http');
const { stripHtml } = require('./common');

/* ── Notion ───────────────────────────────────────────────────────────── */

const NOTION_VERSION = '2022-06-28';
const notionApi = () => (process.env.NOTION_API_URL || 'https://api.notion.com/v1').replace(/\/+$/, '');
const NOTION_ID = /^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BLOCKS = 600;

function notion(ctx, method, path, data, params) {
  return request({
    label: 'Notion', code: 'NOTION', method, url: `${notionApi()}${path}`, data, params,
    headers: { Authorization: `Bearer ${ctx.secret('token')}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
  });
}

function notionId(id) {
  const s = String(id || '').trim();
  // Accept a page URL too: the id is the last 32 hex characters.
  const m = s.match(/([0-9a-f]{32})(?:\?.*)?$/i) || s.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  const out = m ? m[1] : s;
  if (!NOTION_ID.test(out)) throw httpError(400, 'Invalid Notion page id');
  return out;
}

const richText = (arr) => (arr || []).map((t) => {
  let s = t.plain_text || '';
  if (!s) return '';
  const a = t.annotations || {};
  if (a.code) s = `\`${s}\``;
  if (a.bold) s = `**${s}**`;
  if (a.italic) s = `_${s}_`;
  if (a.strikethrough) s = `~~${s}~~`;
  if (t.href) s = `[${s}](${t.href})`;
  return s;
}).join('');

function notionTitle(page) {
  const props = page?.properties || {};
  const titleProp = Object.values(props).find(p => p?.type === 'title');
  return richText(titleProp?.title) || page?.title?.map?.(t => t.plain_text).join('') || 'Untitled';
}

const notionItem = (p) => ({
  id: p.id, title: p.object === 'database' ? (p.title || []).map(t => t.plain_text).join('') || 'Untitled database' : notionTitle(p),
  url: p.url || null, kind: p.object === 'database' ? 'database' : 'page', modifiedAt: p.last_edited_time || null, owner: null, path: null,
});

/** Notion blocks → Markdown (common block types; others are skipped). */
function blocksToMarkdown(blocks, depth = 0) {
  const pad = '  '.repeat(depth);
  const lines = [];
  let n = 0;
  for (const b of blocks) {
    const v = b[b.type] || {};
    const t = richText(v.rich_text);
    if (b.type !== 'numbered_list_item') n = 0;
    switch (b.type) {
      case 'paragraph': lines.push(t ? `${pad}${t}` : ''); break;
      case 'heading_1': lines.push(`# ${t}`); break;
      case 'heading_2': lines.push(`## ${t}`); break;
      case 'heading_3': lines.push(`### ${t}`); break;
      case 'bulleted_list_item': lines.push(`${pad}- ${t}`); break;
      case 'numbered_list_item': n += 1; lines.push(`${pad}${n}. ${t}`); break;
      case 'to_do': lines.push(`${pad}- [${v.checked ? 'x' : ' '}] ${t}`); break;
      case 'toggle': lines.push(`${pad}- ${t}`); break;
      case 'quote': lines.push(`> ${t}`); break;
      case 'callout': lines.push(`> ${v.icon?.emoji ? `${v.icon.emoji} ` : ''}${t}`); break;
      case 'code': lines.push(`\`\`\`${v.language && v.language !== 'plain text' ? v.language : ''}\n${(v.rich_text || []).map(x => x.plain_text).join('')}\n\`\`\``); break;
      case 'divider': lines.push('---'); break;
      case 'bookmark': case 'embed': case 'link_preview': if (v.url) lines.push(`${pad}<${v.url}>`); break;
      case 'image': case 'file': case 'pdf': case 'video': {
        const url = v.external?.url || v.file?.url;
        const cap = richText(v.caption) || b.type;
        if (url) lines.push(b.type === 'image' ? `![${cap}](${url})` : `[${cap}](${url})`);
        break;
      }
      case 'child_page': lines.push(`${pad}- 📄 ${v.title || 'Sub-page'}`); break;
      case 'table_row': lines.push(`| ${(v.cells || []).map(c => richText(c)).join(' | ')} |`); break;
      default: if (t) lines.push(`${pad}${t}`);
    }
    if (Array.isArray(b.children) && b.children.length) lines.push(blocksToMarkdown(b.children, ['bulleted_list_item', 'numbered_list_item', 'to_do', 'toggle'].includes(b.type) ? depth + 1 : depth));
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

async function notionBlocks(ctx, id, budget, depth = 0) {
  const out = [];
  let cursor;
  do {
    const r = await notion(ctx, 'get', `/blocks/${id}/children`, undefined, { page_size: 100, ...(cursor && { start_cursor: cursor }) });
    for (const b of r.results || []) {
      if (budget.left-- <= 0) return out;
      if (b.has_children && depth < 2 && b.type !== 'child_page' && b.type !== 'child_database') b.children = await notionBlocks(ctx, b.id, budget, depth + 1);
      out.push(b);
    }
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor && budget.left > 0);
  return out;
}

const notionConnector = {
  type: 'notion',
  label: 'Notion',
  category: 'docs',
  description: 'Search Notion pages, attach them to messages and tasks, and import pages into Knowledge.',
  setup: [
    'Create an internal integration at notion.so/profile/integrations (Read content capability) and copy its secret.',
    'Paste it below and save — Oruinwan checks it right away.',
    'In Notion, open each page or teamspace you want to use → ••• → Connections → add your integration. Notion only shows the integration pages shared with it.',
  ],
  form: [{ key: 'token', label: 'Internal integration secret', kind: 'secret', required: true, placeholder: 'ntn_… or secret_…' }],
  secrets: ['token'],
  generated: [],
  fields: {},
  defaults: () => ({}),
  toggles: [],
  routes: null,
  required: ['token'],
  webhook: null,
  async test(ctx) {
    const me = await notion(ctx, 'get', '/users/me');
    return { account: { name: me.name || me.bot?.workspace_name || 'Notion integration', workspace: me.bot?.workspace_name || null } };
  },
  actions: {
    search: {
      method: 'GET',
      async run(ctx, { q }) {
        const r = await notion(ctx, 'post', '/search', { query: clip(q, 100), page_size: 25, sort: { direction: 'descending', timestamp: 'last_edited_time' } });
        return { items: (r.results || []).map(notionItem) };
      },
    },
    item: {
      method: 'GET',
      async run(ctx, { id }) {
        return { item: notionItem(await notion(ctx, 'get', `/pages/${notionId(id)}`)) };
      },
    },
    import: {
      method: 'POST',
      importsPage: true,
      async run(ctx, { id }) {
        const pid = notionId(id);
        const page = await notion(ctx, 'get', `/pages/${pid}`);
        const blocks = await notionBlocks(ctx, pid, { left: MAX_BLOCKS });
        const item = notionItem(page);
        return { item, title: item.title, content: blocksToMarkdown(blocks), icon: page.icon?.emoji || '📝', source: 'notion' };
      },
    },
  },
  blocksToMarkdown,
  notionId,
};

/* ── Confluence Cloud ─────────────────────────────────────────────────── */

function confluence(ctx, path, params) {
  return request({
    label: 'Confluence', code: 'CONFLUENCE', method: 'get', url: `${ctx.config.baseUrl}/wiki${path}`, params,
    auth: { username: ctx.config.email, password: ctx.secret('apiToken') }, headers: { Accept: 'application/json' },
  });
}

const confItem = (ctx) => (c) => ({
  id: String(c.id), title: c.title, url: c._links?.webui ? `${ctx.config.baseUrl}/wiki${c._links.webui}` : null,
  kind: c.type || 'page', modifiedAt: c.version?.when || c.history?.lastUpdated?.when || null, owner: c.version?.by?.displayName || null,
  path: c.space?.name || c.space?.key || null,
});

/** Confluence storage format (XHTML) → Markdown (headings, lists, code, links, tables as text). */
function storageToMarkdown(html) {
  let s = String(html || '');
  s = s.replace(/<ac:structured-macro[^>]*ac:name="code"[^>]*>[\s\S]*?<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>[\s\S]*?<\/ac:structured-macro>/g, (_, code) => `\n\`\`\`\n${code}\n\`\`\`\n`);
  s = s.replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => `[${stripHtml(t)}](${href})`);
  s = s.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**').replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '_$2_').replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`');
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${'#'.repeat(Number(n))} ${stripHtml(t)}\n\n`);
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${stripHtml(t).replace(/\n+/g, ' ')}`);
  s = s.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, row) => `\n| ${[...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(m => stripHtml(m[1]).replace(/\n/g, ' ')).join(' | ')} |`);
  s = s.replace(/<\/(ul|ol|table)>/gi, '\n\n');
  s = s.replace(/<hr\s*\/?>/gi, '\n---\n').replace(/<\/p>/gi, '\n\n');
  // Keep the code fences intact while stripping the remaining tags.
  const parts = s.split(/(```[\s\S]*?```)/g).map((p, i) => (i % 2 ? p : stripHtml(p)));
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim();
}

const confluenceConnector = {
  type: 'confluence',
  label: 'Confluence',
  category: 'docs',
  description: 'Search Confluence pages, attach them to messages and tasks, and import pages into Knowledge.',
  setup: [
    'Create an API token at id.atlassian.com/manage-profile/security/api-tokens.',
    'Enter your site address (https://your-team.atlassian.net), the e-mail of that Atlassian account and the token, then save — Oruinwan checks them right away.',
    'Oruinwan sees exactly the spaces and pages that account can see.',
  ],
  form: [
    { key: 'baseUrl', label: 'Site address', kind: 'url', required: true, placeholder: 'https://your-team.atlassian.net' },
    { key: 'email', label: 'Atlassian account e-mail', kind: 'email', required: true },
    { key: 'apiToken', label: 'API token', kind: 'secret', required: true },
  ],
  secrets: ['apiToken'],
  generated: [],
  fields: {
    baseUrl: (v) => normalizeHttpsUrl(v, { name: 'Site address', example: 'https://your-team.atlassian.net' }).replace(/\/wiki$/, ''),
    email: (v) => clip(v, 320),
  },
  defaults: () => ({ baseUrl: '', email: '' }),
  memberHidden: ['email'],
  toggles: [],
  routes: null,
  required: ['baseUrl', 'email', 'apiToken'],
  webhook: null,
  async test(ctx) {
    const me = await confluence(ctx, '/rest/api/user/current');
    return { account: { name: me.displayName || null, email: me.email || ctx.config.email || null } };
  },
  actions: {
    search: {
      method: 'GET',
      async run(ctx, { q }) {
        const text = clip(q, 100).replace(/["\\]/g, ' ');
        const cql = text ? `type = page AND (title ~ "${text}" OR text ~ "${text}") ORDER BY lastmodified DESC` : 'type = page ORDER BY lastmodified DESC';
        const r = await confluence(ctx, '/rest/api/content/search', { cql, limit: 25, expand: 'space,version' });
        return { items: (r.results || []).map(confItem(ctx)) };
      },
    },
    item: {
      method: 'GET',
      async run(ctx, { id }) {
        if (!/^\d{1,20}$/.test(String(id))) throw httpError(400, 'Invalid Confluence page id');
        return { item: confItem(ctx)(await confluence(ctx, `/rest/api/content/${id}`, { expand: 'space,version' })) };
      },
    },
    import: {
      method: 'POST',
      importsPage: true,
      async run(ctx, { id }) {
        if (!/^\d{1,20}$/.test(String(id))) throw httpError(400, 'Invalid Confluence page id');
        const c = await confluence(ctx, `/rest/api/content/${id}`, { expand: 'body.storage,space,version' });
        const item = confItem(ctx)(c);
        return { item, title: c.title || 'Untitled', content: storageToMarkdown(c.body?.storage?.value), icon: '📚', source: 'confluence' };
      },
    },
  },
  storageToMarkdown,
};

module.exports = { notion: notionConnector, confluence: confluenceConnector, blocksToMarkdown, storageToMarkdown };
