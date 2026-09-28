import React, { useEffect, useState } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark';
import oneLight from 'react-syntax-highlighter/dist/esm/styles/prism/one-light';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import kotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin';
import swift from 'react-syntax-highlighter/dist/esm/languages/prism/swift';
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff';
import docker from 'react-syntax-highlighter/dist/esm/languages/prism/docker';
import { Copy, Check, Play, WrapText, ChevronDown, ChevronUp } from 'lucide-react';
import { runJavaScript } from '../../../utils/codeRunner';

[['javascript', javascript], ['js', javascript], ['typescript', typescript], ['ts', typescript], ['jsx', jsx], ['tsx', tsx],
 ['python', python], ['py', python], ['json', json], ['bash', bash], ['sh', bash], ['shell', bash], ['zsh', bash],
 ['css', css], ['scss', css], ['sql', sql], ['java', java], ['go', go],
 ['html', markup], ['xml', markup], ['markup', markup], ['svg', markup], ['markdown', markdown], ['md', markdown],
 ['yaml', yaml], ['yml', yaml], ['ruby', ruby], ['rb', ruby], ['rust', rust], ['rs', rust], ['c', c], ['cpp', cpp], ['c++', cpp],
 ['csharp', csharp], ['cs', csharp], ['php', php], ['kotlin', kotlin], ['kt', kotlin], ['swift', swift], ['diff', diff],
 ['dockerfile', docker], ['docker', docker],
].forEach(([n, l]) => SyntaxHighlighter.registerLanguage(n, l));

const RUNNABLE = new Set(['js', 'javascript']);
const COLLAPSE_AFTER_LINES = 15;

function useDarkTheme() {
    const read = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const [dark, setDark] = useState(read);
    useEffect(() => {
        const obs = new MutationObserver(() => setDark(read()));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => obs.disconnect();
    }, []);
    return dark;
}

const barBtn = {
    display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none',
    color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', padding: '1px 2px',
};

/**
 * A fenced code block: syntax highlighting (light/dark), copy, line-wrap toggle,
 * collapse for long blocks, and "Run" for JavaScript in a sandbox.
 */
export default function CodeBlock({ language = '', code = '', filename = null, runnable = true }) {
    const lang = String(language || '').toLowerCase();
    const dark = useDarkTheme();
    const [copied, setCopied] = useState(false);
    const [wrap, setWrap] = useState(false);
    const lineCount = code.split('\n').length;
    const long = lineCount > COLLAPSE_AFTER_LINES;
    const [expanded, setExpanded] = useState(false);
    const [run, setRun] = useState(null); // { status, output } | 'running'

    const copy = async () => {
        try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
    };
    const execute = async () => {
        setRun('running');
        setRun(await runJavaScript(code));
    };
    const shown = long && !expanded ? code.split('\n').slice(0, COLLAPSE_AFTER_LINES).join('\n') : code;

    return (
        <div data-testid="code-block" data-language={lang || 'text'} style={{ margin: '6px 0', border: '1px solid var(--border-default)', borderRadius: '2px', overflow: 'hidden', maxWidth: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '3px 8px', background: 'var(--bg-active)', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {filename || lang || 'code'}{long && <span style={{ opacity: 0.7 }}> · {lineCount} lines</span>}
                </span>
                <span style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    {runnable && RUNNABLE.has(lang) && (
                        <button type="button" title="Run in sandbox" aria-description="Runs in an isolated sandbox with no access to your account or this page" onClick={execute} disabled={run === 'running'}
                            style={{ ...barBtn, color: 'var(--accent)' }}>
                            <Play size={11} /> {run === 'running' ? 'Running…' : 'Run'}
                        </button>
                    )}
                    <button type="button" title={wrap ? 'Don’t wrap long lines' : 'Wrap long lines'} aria-pressed={wrap} data-testid="code-wrap" onClick={() => setWrap((w) => !w)}
                        style={{ ...barBtn, color: wrap ? 'var(--accent)' : 'var(--text-muted)' }}>
                        <WrapText size={11} /> Wrap
                    </button>
                    <button type="button" title="Copy code" onClick={copy} data-testid="code-copy" style={barBtn}>
                        {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}
                    </button>
                </span>
            </div>
            <div style={{ position: 'relative' }}>
                <SyntaxHighlighter language={lang || 'text'} style={dark ? oneDark : oneLight}
                    customStyle={{ margin: 0, padding: '10px 12px', fontSize: '12.5px', borderRadius: 0, overflowX: wrap ? 'hidden' : 'auto' }}
                    wrapLongLines={wrap}
                    codeTagProps={{ style: { whiteSpace: wrap ? 'pre-wrap' : 'pre', wordBreak: wrap ? 'break-word' : 'normal' } }}>
                    {shown}
                </SyntaxHighlighter>
                {long && !expanded && (
                    <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 36, pointerEvents: 'none',
                        background: `linear-gradient(transparent, ${dark ? '#282c34' : '#fafafa'})` }} />
                )}
            </div>
            {long && (
                <button type="button" data-testid="code-expand" onClick={() => setExpanded((x) => !x)}
                    style={{ ...barBtn, width: '100%', justifyContent: 'center', padding: '4px 0', background: 'var(--bg-active)', borderTop: '1px solid var(--border-subtle)' }}>
                    {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show all {lineCount} lines</>}
                </button>
            )}
            {run && run !== 'running' && (
                <pre data-testid="code-output" style={{ margin: 0, padding: '8px 12px', fontSize: '12px', background: '#111', color: run.status === 'ok' ? '#c8e6c9' : '#ffab91', borderTop: '1px solid var(--border-default)', whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>
                    {run.output.length ? run.output.map((o) => (o.level === 'result' ? `⇒ ${o.text}` : o.text)).join('\n') : '(no output)'}
                </pre>
            )}
        </div>
    );
}
