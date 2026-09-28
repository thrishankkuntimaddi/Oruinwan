import { describe, it, expect } from 'vitest';
import {
    TOPICS, ARTICLES, SHORTCUTS, WHATS_NEW, searchArticles, articlesInTopic, getArticle, resolveAppPath, relatedArticles,
} from '../content/helpArticles';

describe('help articles content', () => {
    it('has unique ids, a known topic and a body for every article', () => {
        const ids = new Set();
        const topics = new Set(TOPICS.map((t) => t.id));
        for (const a of ARTICLES) {
            expect(ids.has(a.id)).toBe(false);
            ids.add(a.id);
            expect(topics.has(a.topic)).toBe(true);
            expect(a.title && a.summary).toBeTruthy();
            expect(Array.isArray(a.body) && a.body.length).toBeTruthy();
        }
        TOPICS.forEach((t) => expect(articlesInTopic(t.id).length).toBeGreaterThan(0));
    });

    it('does not repeat claims the product does not support', () => {
        const text = JSON.stringify(ARTICLES).toLowerCase();
        expect(text).not.toMatch(/sms-based|via sms|sms 2fa/);
        expect(text).not.toMatch(/within 30 days/);
        expect(text).not.toMatch(/csv import/);
        expect(text).not.toMatch(/gemini|openai|chatgpt/);
    });

    it('lists shortcuts and release notes', () => {
        expect(SHORTCUTS.length).toBeGreaterThan(3);
        SHORTCUTS.forEach((s) => expect(Array.isArray(s.keys) && s.keys.every(Array.isArray)).toBe(true));
        expect(WHATS_NEW.length).toBeGreaterThan(3);
    });
});

describe('searchArticles', () => {
    it('returns nothing for an empty query', () => {
        expect(searchArticles('')).toEqual([]);
        expect(searchArticles('   ')).toEqual([]);
    });

    it('finds two-factor sign-in by synonyms', () => {
        for (const q of ['2fa', 'two-factor', 'authenticator']) {
            expect(searchArticles(q).map((a) => a.id)).toContain('two-factor');
        }
    });

    it('ranks title matches first and requires every word', () => {
        const results = searchArticles('threads');
        expect(results[0].id).toBe('threads');
        expect(searchArticles('export data').map((a) => a.id)).toContain('export-data');
        expect(searchArticles('export zzzqqq')).toEqual([]);
    });

    it('ignores case and accents', () => {
        expect(searchArticles('HUDDLE').length).toBeGreaterThan(0);
        expect(searchArticles('huddlé').map((a) => a.id)).toEqual(searchArticles('huddle').map((a) => a.id));
    });

    it('returns related articles from the same topic', () => {
        const related = relatedArticles('threads', 3);
        expect(related.length).toBeGreaterThan(0);
        related.forEach((a) => {
            expect(a.id).not.toBe('threads');
            expect(a.topic).toBe(getArticle('threads').topic);
        });
    });
});

describe('resolveAppPath', () => {
    it('keeps absolute paths', () => {
        expect(resolveAppPath('/settings?tab=security', {})).toBe('/settings?tab=security');
    });

    it('resolves workspace paths from the current workspace, then the last one, then /workspaces', () => {
        expect(resolveAppPath('tasks', { pathname: '/workspace/abc123/home' })).toBe('/workspace/abc123/tasks');
        expect(resolveAppPath('tasks', { pathname: '/help', lastWorkspaceId: 'w9' })).toBe('/workspace/w9/tasks');
        expect(resolveAppPath('tasks', { pathname: '/help' })).toBe('/workspaces');
        expect(resolveAppPath(null, {})).toBe(null);
    });
});
