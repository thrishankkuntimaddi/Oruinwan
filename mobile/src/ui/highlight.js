// Syntax highlighting for code blocks: highlight.js core with a few common languages, loaded
// the first time a code block appears (it is not in the startup bundle). Colours come from the
// app's own tokens (styles/index.css, .hl-*), so code matches the light and dark themes.

const ALIASES = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript', node: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash',
  html: 'xml', svg: 'xml', yml: 'yaml', golang: 'go', kt: 'kotlin', rs: 'rust', 'c++': 'cpp', cs: 'csharp', psql: 'sql',
};

export const LANGUAGES = ['javascript', 'typescript', 'python', 'json', 'bash', 'css', 'xml', 'sql', 'yaml', 'java', 'go', 'kotlin', 'swift', 'rust', 'cpp', 'csharp', 'diff', 'markdown'];

/** The language a fence names ("```ts"), as highlight.js calls it, or null. */
export function languageOf(fence) {
  const name = String(fence || '').trim().toLowerCase().split(/\s+/)[0];
  if (!name) return null;
  const lang = ALIASES[name] || name;
  return LANGUAGES.includes(lang) ? lang : null;
}

let loading = null;

/** Resolves with a configured highlight.js instance (loaded once). */
export function loadHighlighter() {
  loading ||= (async () => {
    const [{ default: hljs }, ...langs] = await Promise.all([
      import('highlight.js/lib/core'),
      import('highlight.js/lib/languages/javascript'),
      import('highlight.js/lib/languages/typescript'),
      import('highlight.js/lib/languages/python'),
      import('highlight.js/lib/languages/json'),
      import('highlight.js/lib/languages/bash'),
      import('highlight.js/lib/languages/css'),
      import('highlight.js/lib/languages/xml'),
      import('highlight.js/lib/languages/sql'),
      import('highlight.js/lib/languages/yaml'),
      import('highlight.js/lib/languages/java'),
      import('highlight.js/lib/languages/go'),
      import('highlight.js/lib/languages/kotlin'),
      import('highlight.js/lib/languages/swift'),
      import('highlight.js/lib/languages/rust'),
      import('highlight.js/lib/languages/cpp'),
      import('highlight.js/lib/languages/csharp'),
      import('highlight.js/lib/languages/diff'),
      import('highlight.js/lib/languages/markdown'),
    ]);
    LANGUAGES.forEach((name, i) => hljs.registerLanguage(name, langs[i].default));
    hljs.configure({ classPrefix: 'hl-' });
    return hljs;
  })().catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

const MAX = 20_000;

/**
 * Highlighted HTML for code (highlight.js escapes the code itself), or null when it can't or
 * shouldn't be highlighted. Without a named language, a guess is used only when it is confident.
 */
export function highlightHtml(hljs, code, lang) {
  if (!hljs || !code || code.length > MAX) return null;
  try {
    if (lang) return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    const auto = hljs.highlightAuto(code, LANGUAGES);
    return auto.relevance >= 5 ? auto.value : null;
  } catch {
    return null;
  }
}
