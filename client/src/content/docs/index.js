/**
 * Oruinwan documentation: the table of contents, lookups and search.
 *
 * One module per section (./getting-started.js, ./messaging.js, …). Each
 * exports { id, title, icon, blurb, pages: [{ id, title, summary, keywords, blocks }] }.
 * Pages are served at /docs/:section/:page. The block format is described in ./utils.js.
 *
 * Facts in these pages were checked against the code (routes, settings tabs,
 * server features) and reuse the fact-checked help articles in ../helpArticles.js.
 * When a feature changes, update the page here.
 */
import start from './getting-started';
import company from './company';
import messaging from './messaging';
import ai from './ai';
import tasks from './tasks';
import notes from './notes-files';
import huddles from './huddles';
import notifications from './notifications';
import integrations from './integrations';
import developers from './developers';
import settings from './settings';
import security from './security';
import platforms from './platforms';
import { headingsOf, blockText, normalize, queryWords, plainText } from './utils';

export { headingsOf, slugify, linksOf, plainText } from './utils';

export const SECTIONS = [start, company, messaging, ai, tasks, notes, huddles, notifications, integrations, developers, settings, security, platforms];

/** Sidebar groups, in order. */
export const GROUPS = [
    { title: 'Get started', sections: ['start', 'company'] },
    { title: 'Work in Oruinwan', sections: ['messaging', 'ai', 'tasks', 'notes', 'huddles', 'notifications'] },
    { title: 'Connect & build', sections: ['integrations', 'developers'] },
    { title: 'Account & trust', sections: ['settings', 'security', 'platforms'] },
];

const sectionById = new Map(SECTIONS.map((s) => [s.id, s]));

export const docsPath = (sectionId, pageId, anchor) =>
    `/docs${sectionId ? `/${sectionId}` : ''}${pageId ? `/${pageId}` : ''}${anchor ? `#${anchor}` : ''}`;

export const getSection = (id) => sectionById.get(id) || null;
export const getPage = (sectionId, pageId) => getSection(sectionId)?.pages.find((p) => p.id === pageId) || null;

/** Every page in reading order: { section, page, path }. */
export const ALL_PAGES = GROUPS.flatMap((g) => g.sections.map(getSection))
    .flatMap((section) => section.pages.map((page) => ({ section, page, path: docsPath(section.id, page.id) })));

/** Previous and next page in reading order (across sections). */
export function neighbours(sectionId, pageId) {
    const i = ALL_PAGES.findIndex((e) => e.section.id === sectionId && e.page.id === pageId);
    if (i < 0) return { prev: null, next: null };
    return { prev: ALL_PAGES[i - 1] || null, next: ALL_PAGES[i + 1] || null };
}

// ── Search ────────────────────────────────────────────────────────────────

/** One entry per page plus one per heading, so results can jump to a section. */
const INDEX = ALL_PAGES.flatMap(({ section, page, path }) => {
    const heads = headingsOf(page);
    const entries = [{
        section, page, path, anchor: null, heading: null,
        title: normalize(page.title),
        keywords: normalize(page.keywords),
        summary: normalize(page.summary),
        sectionTitle: normalize(section.title),
        body: normalize(page.blocks.map(blockText).join(' ')),
        snippetSource: plainText(page.summary),
    }];
    // Text under each heading, for heading-level hits.
    let current = null;
    let buf = [];
    const flush = () => {
        if (!current) return;
        entries.push({
            section, page, path, anchor: current.id, heading: current.text,
            title: normalize(current.text), keywords: '', summary: '', sectionTitle: normalize(page.title),
            body: normalize(buf.join(' ')), snippetSource: buf.join(' ').slice(0, 220),
        });
    };
    let hi = 0;
    for (const b of page.blocks) {
        if (b && typeof b === 'object' && (b.h || b.h3)) {
            flush();
            current = heads[hi++];
            buf = [];
        } else if (current) {
            buf.push(blockText(b));
        }
    }
    flush();
    return entries;
});

/**
 * Instant search across every docs page. Every word of the query must appear
 * somewhere in the entry; ranking: title > keywords > summary > section > body.
 * Returns up to `limit` results: { section, page, path, anchor, heading, snippet }.
 * A page and its own headings are collapsed so each page appears at most twice.
 */
export function searchDocs(query, limit = 12) {
    const words = queryWords(query);
    if (!words.length) return [];
    const scored = [];
    INDEX.forEach((e, order) => {
        let score = 0;
        for (const w of words) {
            let s = 0;
            if (e.title.includes(w)) s += e.title.startsWith(w) ? 14 : 10;
            if (e.keywords.includes(w)) s += 6;
            if (e.summary.includes(w)) s += 4;
            if (e.sectionTitle.includes(w)) s += 2;
            if (e.body.includes(w)) s += 1;
            if (!s) return;
            score += s;
        }
        if (!e.anchor) score += 1; // prefer the page itself on ties
        scored.push({ e, score, order });
    });
    scored.sort((a, b) => b.score - a.score || a.order - b.order);
    const perPage = new Map();
    const out = [];
    for (const { e } of scored) {
        const n = perPage.get(e.path) || 0;
        if (n >= 2) continue;
        perPage.set(e.path, n + 1);
        out.push({
            section: e.section, page: e.page, path: e.path, anchor: e.anchor, heading: e.heading,
            snippet: e.snippetSource.length > 200 ? `${e.snippetSource.slice(0, 197)}…` : e.snippetSource,
        });
        if (out.length >= limit) break;
    }
    return out;
}
