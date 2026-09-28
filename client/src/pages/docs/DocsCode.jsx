import React, { useId, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { PrismLight } from 'react-syntax-highlighter';
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';

// Only what the docs use, so the docs chunk stays small.
const LANGS = { javascript, bash, json, python, yaml };
Object.entries(LANGS).forEach(([name, lang]) => PrismLight.registerLanguage(name, lang));
const ALIAS = { js: 'javascript', node: 'javascript', sh: 'bash', shell: 'bash', curl: 'bash', env: 'bash', py: 'python', yml: 'yaml' };

// one-dark without its own background: the docs code panel paints one.
const THEME = Object.fromEntries(Object.entries(oneDark).map(([k, v]) => {
    const { background: _b, backgroundColor: _bc, textShadow: _t, ...rest } = v || {};
    return [k, rest];
}));

export function CopyButton({ text, label = 'Copy code' }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch { /* clipboard blocked: nothing to do */ }
    };
    return (
        <button type="button" className="docs-code__copy" onClick={copy} aria-label={copied ? 'Copied' : label}>
            {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
            <span className="orw-sr" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
        </button>
    );
}

function Highlighted({ code, lang }) {
    const language = ALIAS[lang] || lang;
    if (!language || !LANGS[language]) return <pre className="docs-code__pre"><code>{code}</code></pre>;
    return (
        <PrismLight
            language={language}
            style={THEME}
            PreTag={({ children, ...p }) => <pre {...p} className="docs-code__pre">{children}</pre>}
            customStyle={{ margin: 0, padding: 0, background: 'none' }}
            codeTagProps={{ style: { fontFamily: 'inherit' } }}
        >
            {code}
        </PrismLight>
    );
}

export function CodeBlock({ code, lang, title }) {
    const text = String(code).replace(/\n$/, '');
    return (
        <figure className="docs-code">
            <figcaption className="docs-code__bar">
                <span className="docs-code__title">{title || lang || 'code'}</span>
                <CopyButton text={text} />
            </figcaption>
            <Highlighted code={text} lang={lang} />
        </figure>
    );
}

/** Same example in several languages (curl / SDK / Python …). Arrow keys switch tabs. */
export function CodeTabs({ tabs }) {
    const [active, setActive] = useState(0);
    const base = useId();
    const refs = useRef([]);
    const onKey = (e) => {
        const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        const next = (active + dir + tabs.length) % tabs.length;
        setActive(next);
        refs.current[next]?.focus();
    };
    const tab = tabs[active];
    const text = String(tab.code).replace(/\n$/, '');
    return (
        <figure className="docs-code">
            <div className="docs-code__bar">
                <div role="tablist" aria-label="Code examples" className="docs-code__tabs" onKeyDown={onKey}>
                    {tabs.map((t, i) => (
                        <button key={t.label} type="button" role="tab" ref={(el) => { refs.current[i] = el; }}
                            id={`${base}-t${i}`} aria-controls={`${base}-p`} aria-selected={i === active}
                            tabIndex={i === active ? 0 : -1} onClick={() => setActive(i)}
                            className={`docs-code__tab${i === active ? ' is-active' : ''}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <CopyButton text={text} />
            </div>
            <div role="tabpanel" id={`${base}-p`} aria-labelledby={`${base}-t${active}`}>
                <Highlighted code={text} lang={tab.lang} />
            </div>
        </figure>
    );
}
