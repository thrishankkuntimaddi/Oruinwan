// Import Markdown / plain-text files as Knowledge pages. Runs in the browser: the file is read
// as text and sent through the ordinary "create page" call, so nothing new is needed on the server.

export const IMPORT_ACCEPT = '.md,.markdown,.mdown,.txt,text/markdown,text/plain';
export const IMPORT_MAX_BYTES = 1024 * 1024; // 1 MB of text is a very long page already
const EXT_RE = /\.(md|markdown|mdown|txt)$/i;

/** Why a file can't be imported, or null when it can. */
export function importProblem(file) {
    if (!file) return 'No file';
    const name = String(file.name || '');
    const type = String(file.type || '').toLowerCase();
    if (!EXT_RE.test(name) && !type.startsWith('text/')) return `“${name || 'This file'}” isn’t a Markdown or text file`;
    if (file.size > IMPORT_MAX_BYTES) return `“${name}” is larger than 1 MB`;
    return null;
}

/**
 * { title, content } for a page made from a file. The title is the first "# Heading" when the
 * text starts with one (that heading is then dropped from the body), else the file name.
 */
export function pageFromImport(fileName, text) {
    const body = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const fallback = String(fileName || '').replace(EXT_RE, '').replace(/[_-]+/g, ' ').trim() || 'Imported page';
    const m = body.match(/^\s*#\s+(.+?)\s*#*\s*(\n|$)/);
    if (m) {
        return { title: m[1].trim().slice(0, 200), content: body.slice(m[0].length).replace(/^\n+/, '') };
    }
    return { title: fallback.slice(0, 200), content: body };
}

/** Read and convert files; resolves { pages: [{ title, content }], problems: [message] }. */
export async function readImportFiles(fileList) {
    const pages = [];
    const problems = [];
    for (const file of [...(fileList || [])]) {
        const problem = importProblem(file);
        if (problem) { problems.push(problem); continue; }
        try {
            const text = typeof file.text === 'function' ? await file.text() : await new Response(file).text();
            pages.push(pageFromImport(file.name, text));
        } catch {
            problems.push(`Couldn’t read “${file.name}”`);
        }
    }
    return { pages, problems };
}
