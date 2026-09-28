// Pure helpers for GitHub / Jira references typed in messages and slash commands.
// Kept free of React so they are unit-tested (src/__tests__/integrationRefs.test.js).

const REPO_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;

/** "owner/name" (GitHub's allowed characters) — no "#", no URL. */
export const isRepo = (s) => REPO_RE.test(String(s || '').trim());

// https://github.com/<owner>/<repo>/pull/<n>  (optionally /files, /commits, #fragment, ?query)
const PR_URL_SOURCE = String.raw`https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})\/pull\/(\d{1,9})(?=$|[\/?#\s)\]>.,;:!'"])`;

/**
 * Parse one PR reference:
 *   "owner/repo#12", "owner/repo 12", "owner/repo/pull/12", "https://github.com/owner/repo/pull/12[/files]"
 * Returns { repo: 'owner/repo', number: 12, url } or null.
 */
export function parsePrRef(input) {
    const s = String(input || '').trim().replace(/^<|>$/g, '');
    if (!s) return null;
    const url = new RegExp(`^${PR_URL_SOURCE}`, 'i').exec(s);
    if (url) return makeRef(`${url[1]}/${url[2]}`, url[3]);
    const short = /^([A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}?)(?:#|\s+#?|\/pull\/)(\d{1,9})$/.exec(s);
    if (short && isRepo(short[1])) return makeRef(short[1], short[2]);
    return null;
}

function makeRef(repo, n) {
    const number = Number(n);
    if (!Number.isInteger(number) || number <= 0) return null;
    return { repo, number, url: prUrl(repo, number) };
}

export const prUrl = (repo, number) => `https://github.com/${repo}/pull/${number}`;
export const prKey = (ref) => (ref ? `${String(ref.repo).toLowerCase()}#${ref.number}` : '');

/** Every distinct GitHub PR URL in a message's text, in order (max `limit`). */
export function findPrUrls(text, limit = 3) {
    const out = [];
    const seen = new Set();
    if (!text) return out;
    const re = new RegExp(PR_URL_SOURCE, 'gi');
    let m;
    while ((m = re.exec(String(text))) && out.length < limit) {
        const ref = makeRef(`${m[1]}/${m[2]}`, m[3]);
        if (ref && !seen.has(prKey(ref))) { seen.add(prKey(ref)); out.push(ref); }
    }
    return out;
}

/**
 * Arguments of `/github …`:
 *   "issue [owner/repo] <title>"  -> { sub: 'issue', repo|null, title }
 *   "pr <ref>" | "<ref>"          -> { sub: 'pr', ref }
 *   ""                            -> { sub: 'help' }
 * Anything else -> { sub: 'invalid', error }.
 */
export function parseGithubArgs(args) {
    const s = String(args || '').trim();
    if (!s || /^help$/i.test(s)) return { sub: 'help' };
    const m = /^(\S+)(?:\s+([\s\S]*))?$/.exec(s);
    const head = m[1].toLowerCase();
    const rest = (m[2] || '').trim();
    if (head === 'issue') {
        const parts = /^(\S+)(?:\s+([\s\S]*))?$/.exec(rest);
        if (parts && isRepo(parts[1]) && !/#\d+$/.test(parts[1])) {
            const title = (parts[2] || '').trim();
            return title ? { sub: 'issue', repo: parts[1], title } : { sub: 'invalid', error: 'Add a title: /github issue owner/repo <title>' };
        }
        return rest ? { sub: 'issue', repo: null, title: rest } : { sub: 'invalid', error: 'Add a title: /github issue <title>' };
    }
    if (head === 'pr' || head === 'review') {
        const ref = parsePrRef(rest);
        return ref ? { sub: 'pr', ref } : { sub: 'invalid', error: 'Use a pull request like owner/repo#12' };
    }
    const direct = parsePrRef(s);
    if (direct) return { sub: 'pr', ref: direct };
    return { sub: 'invalid', error: 'Try /github issue <title> or /github pr owner/repo#12' };
}

/** `/jira PROJ summary text` -> { projectKey: 'PROJ', summary } | { error } */
export function parseJiraArgs(args) {
    const m = /^([A-Za-z][A-Za-z0-9_]{0,19})\s+([\s\S]+)$/.exec(String(args || '').trim());
    if (!m) return { error: 'Usage: /jira <PROJECT> <summary>, for example /jira WEB Fix the login redirect' };
    return { projectKey: m[1].toUpperCase(), summary: m[2].trim() };
}

/** Which repo a channel's GitHub routes point at (for `/github issue <title>` without a repo). */
export function defaultRepoForChannel(routes, channelId) {
    const list = Array.isArray(routes) ? routes.filter((r) => r && isRepo(r.repo)) : [];
    const here = list.find((r) => channelId && String(r.channelId) === String(channelId));
    return (here || list[0])?.repo || null;
}

/** Language id for syntax highlighting, from a file name. */
const EXT_LANG = {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
    py: 'python', json: 'json', sh: 'bash', bash: 'bash', zsh: 'bash', css: 'css', scss: 'scss',
    sql: 'sql', java: 'java', go: 'go', yml: 'yaml', yaml: 'yaml', md: 'markdown', markdown: 'markdown',
    rs: 'rust', rb: 'ruby', php: 'php', c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', hpp: 'cpp', cs: 'csharp',
    kt: 'kotlin', kts: 'kotlin', swift: 'swift', html: 'markup', htm: 'markup', xml: 'markup', svg: 'markup', vue: 'markup',
};
export function languageForFile(filename, hint) {
    if (hint && typeof hint === 'string') {
        const h = hint.toLowerCase();
        if (Object.values(EXT_LANG).includes(h)) return h;
    }
    const base = String(filename || '').split('/').pop() || '';
    if (/^dockerfile/i.test(base)) return 'docker';
    const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : '';
    return EXT_LANG[ext] || 'text';
}
