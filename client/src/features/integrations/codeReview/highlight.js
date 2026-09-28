// Prism (via react-syntax-highlighter, already used by chat code blocks) with
// the languages PR diffs commonly contain. Loaded with the code-review chunk.
import { PrismLight, createElement } from 'react-syntax-highlighter';
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark';
import oneLight from 'react-syntax-highlighter/dist/esm/styles/prism/one-light';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import scss from 'react-syntax-highlighter/dist/esm/languages/prism/scss';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import kotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin';
import swift from 'react-syntax-highlighter/dist/esm/languages/prism/swift';
import docker from 'react-syntax-highlighter/dist/esm/languages/prism/docker';

const LANGS = { javascript, jsx, typescript, tsx, python, json, bash, css, scss, sql, java, go, yaml, markdown, markup, rust, ruby, php, c, cpp, csharp, kotlin, swift, docker };
Object.entries(LANGS).forEach(([name, lang]) => PrismLight.registerLanguage(name, lang));

export const isKnownLanguage = (lang) => Object.prototype.hasOwnProperty.call(LANGS, lang);

/** Theme without the backgrounds: the diff rows paint their own. */
function stripBackgrounds(theme) {
    const out = {};
    for (const [k, v] of Object.entries(theme)) {
        const { background: _bg, backgroundColor: _bgc, textShadow: _ts, ...rest } = v || {};
        out[k] = rest;
    }
    return out;
}
export const DARK_THEME = stripBackgrounds(oneDark);
export const LIGHT_THEME = stripBackgrounds(oneLight);

export { PrismLight as Highlighter, createElement };
