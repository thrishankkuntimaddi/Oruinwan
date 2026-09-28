import { describe, it, expect } from 'vitest';
import {
    parsePrRef, findPrUrls, parseGithubArgs, parseJiraArgs, defaultRepoForChannel, languageForFile, isRepo, prKey,
} from '../features/integrations/prRefs';
import { parsePatch, groupHunks, diffStats, groupByDirectory } from '../features/integrations/codeReview/diffParse';

describe('PR references', () => {
    it('parses short refs and URLs', () => {
        expect(parsePrRef('acme/web#12')).toEqual({ repo: 'acme/web', number: 12, url: 'https://github.com/acme/web/pull/12' });
        expect(parsePrRef('acme/web 7')).toMatchObject({ repo: 'acme/web', number: 7 });
        expect(parsePrRef('acme/my.repo_x/pull/3')).toMatchObject({ repo: 'acme/my.repo_x', number: 3 });
        expect(parsePrRef('https://github.com/acme/web/pull/42')).toMatchObject({ repo: 'acme/web', number: 42 });
        expect(parsePrRef('https://github.com/acme/web/pull/42/files#diff-1')).toMatchObject({ number: 42 });
        expect(parsePrRef('<https://www.github.com/a-b/c/pull/9>')).toMatchObject({ repo: 'a-b/c', number: 9 });
    });
    it('rejects things that are not PRs', () => {
        expect(parsePrRef('')).toBeNull();
        expect(parsePrRef('acme#12')).toBeNull();
        expect(parsePrRef('acme/web#0')).toBeNull();
        expect(parsePrRef('https://github.com/acme/web/issues/12')).toBeNull();
        expect(parsePrRef('https://gitlab.com/acme/web/pull/12')).toBeNull();
        expect(parsePrRef('acme/web#12 extra')).toBeNull();
    });
    it('finds distinct PR URLs in message text', () => {
        const text = 'see https://github.com/acme/web/pull/1, and (https://github.com/acme/api/pull/22). Again https://github.com/Acme/Web/pull/1/files';
        expect(findPrUrls(text).map(prKey)).toEqual(['acme/web#1', 'acme/api#22']);
        expect(findPrUrls('https://github.com/acme/web/pull/12345678901')).toEqual([]);
        expect(findPrUrls('https://github.com/acme/web/pulls')).toEqual([]);
        expect(findPrUrls(null)).toEqual([]);
    });
    it('validates repo names', () => {
        expect(isRepo('acme/web')).toBe(true);
        expect(isRepo('acme/web#1')).toBe(false);
        expect(isRepo('-acme/web')).toBe(false);
    });
});

describe('slash command arguments', () => {
    it('/github', () => {
        expect(parseGithubArgs('')).toEqual({ sub: 'help' });
        expect(parseGithubArgs('issue Login is broken')).toEqual({ sub: 'issue', repo: null, title: 'Login is broken' });
        expect(parseGithubArgs('issue acme/web Login is broken')).toEqual({ sub: 'issue', repo: 'acme/web', title: 'Login is broken' });
        expect(parseGithubArgs('issue acme/web').sub).toBe('invalid');
        expect(parseGithubArgs('issue').sub).toBe('invalid');
        expect(parseGithubArgs('pr acme/web#12')).toMatchObject({ sub: 'pr', ref: { repo: 'acme/web', number: 12 } });
        expect(parseGithubArgs('https://github.com/acme/web/pull/5')).toMatchObject({ sub: 'pr', ref: { number: 5 } });
        expect(parseGithubArgs('pr nope').sub).toBe('invalid');
        expect(parseGithubArgs('frobnicate').sub).toBe('invalid');
    });
    it('/jira', () => {
        expect(parseJiraArgs('web Fix the login redirect')).toEqual({ projectKey: 'WEB', summary: 'Fix the login redirect' });
        expect(parseJiraArgs('WEB').error).toBeTruthy();
        expect(parseJiraArgs('').error).toBeTruthy();
    });
    it('picks the repo routed to the channel', () => {
        const routes = [{ repo: '*', channelId: 'c1' }, { repo: 'acme/api', channelId: 'c2' }, { repo: 'acme/web', channelId: 'c1' }];
        expect(defaultRepoForChannel(routes, 'c1')).toBe('acme/web');
        expect(defaultRepoForChannel(routes, 'zz')).toBe('acme/api');
        expect(defaultRepoForChannel([], 'c1')).toBeNull();
    });
    it('maps files to highlighter languages', () => {
        expect(languageForFile('src/App.jsx')).toBe('jsx');
        expect(languageForFile('a/b/Dockerfile')).toBe('docker');
        expect(languageForFile('README')).toBe('text');
        expect(languageForFile('x.weird', 'python')).toBe('python');
    });
});

describe('diff parsing', () => {
    const patch = '@@ -1,3 +1,4 @@ function a()\n const x = 1;\n-const y = 2;\n+const y = 3;\n+const z = 4;\n return x;\n\\ No newline at end of file\n@@ -10,2 +11,2 @@\n-old\n+new\n';
    it('numbers old and new lines', () => {
        const rows = parsePatch(patch);
        expect(rows[0]).toMatchObject({ kind: 'hunk', heading: 'function a()' });
        expect(rows[1]).toMatchObject({ kind: 'ctx', text: 'const x = 1;', oldNo: 1, newNo: 1 });
        expect(rows[2]).toMatchObject({ kind: 'del', text: 'const y = 2;', oldNo: 2, newNo: null });
        expect(rows[3]).toMatchObject({ kind: 'add', text: 'const y = 3;', oldNo: null, newNo: 2 });
        expect(rows[4]).toMatchObject({ kind: 'add', newNo: 3 });
        expect(rows[5]).toMatchObject({ kind: 'ctx', oldNo: 3, newNo: 4 });
        expect(rows[6]).toMatchObject({ kind: 'meta' });
        expect(rows[8]).toMatchObject({ kind: 'del', oldNo: 10 });
        expect(rows[9]).toMatchObject({ kind: 'add', newNo: 11 });
        expect(parsePatch(undefined)).toEqual([]);
    });
    it('groups hunks and counts', () => {
        const groups = groupHunks(parsePatch(patch));
        expect(groups).toHaveLength(2);
        expect(groups[0].rows).toHaveLength(6);
        expect(diffStats([{ patch }])).toEqual({ additions: 3, deletions: 2, files: 1 });
        expect(diffStats([{ additions: 5, deletions: 1 }, { additions: 1, deletions: 0 }])).toEqual({ additions: 6, deletions: 1, files: 2 });
    });
    it('groups files by folder, root first', () => {
        const g = groupByDirectory([{ filename: 'src/b.js' }, { filename: 'README.md' }, { filename: 'src/a/c.js' }]);
        expect(g.map((x) => x.dir)).toEqual(['', 'src', 'src/a']);
    });
});
