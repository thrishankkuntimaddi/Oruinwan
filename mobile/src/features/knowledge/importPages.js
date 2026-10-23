// Import Markdown / plain-text files as Knowledge pages, the same way the web does
// (client/src/pages/SidebarComp/knowledgeImport.js): the file is read on the device and sent
// through the ordinary "create page" call.

export const IMPORT_ACCEPT = '.md,.markdown,.mdown,.txt,text/markdown,text/plain';
export const IMPORT_MAX_BYTES = 1024 * 1024;
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

/** { title, content }: the first "# Heading" becomes the title, else the file name. */
export function pageFromImport(fileName, text) {
  const body = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const fallback = String(fileName || '').replace(EXT_RE, '').replace(/[_-]+/g, ' ').trim() || 'Imported page';
  const m = body.match(/^\s*#\s+(.+?)\s*#*\s*(\n|$)/);
  if (m) return { title: m[1].trim().slice(0, 200), content: body.slice(m[0].length).replace(/^\n+/, '') };
  return { title: fallback.slice(0, 200), content: body };
}

/** Read and convert files; resolves { pages, problems }. */
export async function readImportFiles(fileList) {
  const pages = [];
  const problems = [];
  for (const file of [...(fileList || [])]) {
    const problem = importProblem(file);
    if (problem) {
      problems.push(problem);
      continue;
    }
    try {
      const text = typeof file.text === 'function' ? await file.text() : await new Response(file).text();
      pages.push(pageFromImport(file.name, text));
    } catch {
      problems.push(`Couldn’t read “${file.name}”`);
    }
  }
  return { pages, problems };
}
