import { describe, it, expect } from 'vitest';
import {
    SECTIONS, GROUPS, ALL_PAGES, getSection, getPage, neighbours, headingsOf, linksOf, searchDocs, docsPath,
} from '../content/docs';
import { slugify, plainText, queryWords } from '../content/docs/utils';

const KNOWN_BLOCKS = ['h', 'h3', 'list', 'steps', 'callout', 'table', 'code', 'codeTabs', 'figure', 'shortcuts', 'cards'];
const FIGURES = ['chat-ai', 'ai-panel', 'pr-card', 'huddle', 'board', 'notify-rules', 'company-tree', 'workspace-tree',
    'github-flow', 'ai-engine', 'api-flow', 'webhook-flow', 'e2ee'];

describe('docs navigation', () => {
    it('lists every section exactly once in the sidebar groups', () => {
        const grouped = GROUPS.flatMap((g) => g.sections);
        expect(new Set(grouped).size).toBe(grouped.length);
        expect(grouped.sort()).toEqual(SECTIONS.map((s) => s.id).sort());
    });

    it('every nav entry resolves to a page with content', () => {
        for (const g of GROUPS) {
            for (const sid of g.sections) {
                const section = getSection(sid);
                expect(section, sid).toBeTruthy();
                expect(section.title && section.blurb).toBeTruthy();
                expect(section.pages.length).toBeGreaterThan(0);
                const ids = new Set();
                for (const p of section.pages) {
                    expect(ids.has(p.id), `${sid}/${p.id} duplicated`).toBe(false);
                    ids.add(p.id);
                    expect(getPage(sid, p.id)).toBe(p);
                    expect(p.title && p.summary, `${sid}/${p.id}`).toBeTruthy();
                    expect(p.blocks.length, `${sid}/${p.id} is empty`).toBeGreaterThan(0);
                    const text = p.blocks.filter((b) => typeof b === 'string' || b.list || b.steps || b.table || b.callout).length;
                    expect(text, `${sid}/${p.id} has no prose`).toBeGreaterThan(0);
                }
            }
        }
        expect(ALL_PAGES.length).toBeGreaterThan(50);
    });

    it('only uses known block types and figures', () => {
        for (const { page, path } of ALL_PAGES) {
            for (const b of page.blocks) {
                if (typeof b === 'string') continue;
                const kinds = Object.keys(b).filter((k) => KNOWN_BLOCKS.includes(k));
                expect(kinds.length, `${path}: ${JSON.stringify(b).slice(0, 80)}`).toBe(1);
                if (b.figure) expect(FIGURES).toContain(b.figure);
                if (b.table) b.table.rows.forEach((r) => expect(r.length).toBe(b.table.head.length));
            }
        }
    });

    it('gives each page unique heading ids', () => {
        for (const { page, path } of ALL_PAGES) {
            const ids = headingsOf(page).map((h) => h.id);
            expect(new Set(ids).size, path).toBe(ids.length);
        }
    });

    it('every internal docs link points at a real page (and heading, when it has one)', () => {
        const broken = [];
        for (const { page, path } of ALL_PAGES) {
            for (const href of linksOf(page)) {
                const [route, hash] = href.split('#');
                const [, , sid, pid] = route.split('/');
                const target = pid ? getPage(sid, pid) : getSection(sid);
                if (!target) { broken.push(`${path} → ${href}`); continue; }
                if (hash && pid && !headingsOf(target).some((h) => h.id === hash)) broken.push(`${path} → ${href} (no heading)`);
            }
        }
        expect(broken).toEqual([]);
    });

    it('walks pages in order with previous and next', () => {
        const first = ALL_PAGES[0];
        const last = ALL_PAGES[ALL_PAGES.length - 1];
        expect(neighbours(first.section.id, first.page.id).prev).toBeNull();
        expect(neighbours(last.section.id, last.page.id).next).toBeNull();
        const mid = ALL_PAGES[5];
        const { prev, next } = neighbours(mid.section.id, mid.page.id);
        expect(prev.path).toBe(ALL_PAGES[4].path);
        expect(next.path).toBe(ALL_PAGES[6].path);
        expect(docsPath('messaging', 'threads', 'x')).toBe('/docs/messaging/threads#x');
    });
});

describe('docs search', () => {
    it('finds pages by title, keyword and body text', () => {
        expect(searchDocs('threads')[0].page.id).toBe('threads');
        expect(searchDocs('2FA').some((r) => r.page.id === 'password-security')).toBe(true);
        expect(searchDocs('X-Chttrix-Signature').some((r) => r.section.id === 'developers' && r.page.id === 'webhooks')).toBe(true);
        expect(searchDocs('ollama').some((r) => r.page.id === 'local-engine')).toBe(true);
        expect(searchDocs('TXT record').some((r) => r.page.id === 'domain-verification')).toBe(true);
    });

    it('can jump to a heading inside a page', () => {
        const hit = searchDocs('verify the signature').find((r) => r.anchor);
        expect(hit).toBeTruthy();
        expect(headingsOf(hit.page).some((h) => h.id === hit.anchor)).toBe(true);
    });

    it('requires every word, ignores accents and case, and limits results', () => {
        expect(searchDocs('')).toEqual([]);
        expect(searchDocs('huddlé wrap')[0].page.id).toBe('wrap-up');
        expect(searchDocs('zzzz-not-a-word')).toEqual([]);
        expect(searchDocs('the', 5).length).toBeLessThanOrEqual(5);
        const paths = searchDocs('task', 50).map((r) => r.path);
        const perPage = paths.reduce((m, p) => m.set(p, (m.get(p) || 0) + 1), new Map());
        expect(Math.max(...perPage.values())).toBeLessThanOrEqual(2);
    });
});

describe('docs utils', () => {
    it('slugifies headings and strips inline markup', () => {
        expect(slugify('1. Connect with a `token`!')).toBe('1-connect-with-a-token');
        expect(slugify('Owner, Admin & Manager')).toBe('owner-admin-and-manager');
        expect(plainText('Press [[Mod+K]] or see [Search](/docs/messaging/search) **now** `x`')).toBe('Press Mod K or see Search now x');
        expect(queryWords('Threads  Mentions')).toEqual(['thread', 'mention']);
    });

    it('does not claim things the product does not do', () => {
        const text = JSON.stringify(SECTIONS).toLowerCase();
        expect(text).not.toMatch(/sms-based|via sms|sms 2fa/);
        expect(text).not.toMatch(/attachments are end-to-end encrypted/);
        expect(text).not.toMatch(/authorization: bearer chx_/);
    });
});
