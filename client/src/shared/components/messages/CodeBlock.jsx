import React, { useState } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import { Copy, Check, Play } from 'lucide-react';
import { runJavaScript } from '../../../utils/codeRunner';

[['javascript', javascript], ['js', javascript], ['typescript', typescript], ['ts', typescript], ['jsx', jsx],
 ['python', python], ['py', python], ['json', json], ['bash', bash], ['sh', bash], ['shell', bash],
 ['css', css], ['sql', sql], ['java', java], ['go', go]].forEach(([n, l]) => SyntaxHighlighter.registerLanguage(n, l));

const RUNNABLE = new Set(['js', 'javascript']);

export default function CodeBlock({ language = '', code }) {
    const lang = String(language || '').toLowerCase();
    const [copied, setCopied] = useState(false);
    const [run, setRun] = useState(null); // { status, output } | 'running'

    const copy = async () => {
        try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
    };
    const execute = async () => {
        setRun('running');
        setRun(await runJavaScript(code));
    };

    return (
        <div data-testid="code-block" style={{ margin: '6px 0', border: '1px solid var(--border-default)', borderRadius: '2px', overflow: 'hidden', maxWidth: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 8px', background: 'var(--bg-active)', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                <span>{lang || 'code'}</span>
                <span style={{ display: 'flex', gap: '6px' }}>
                    {RUNNABLE.has(lang) && (
                        <button type="button" title="Run in sandbox" onClick={execute} disabled={run === 'running'}
                            style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px' }}>
                            <Play size={11} /> {run === 'running' ? 'Running…' : 'Run'}
                        </button>
                    )}
                    <button type="button" title="Copy code" onClick={copy}
                        style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}>
                        {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}
                    </button>
                </span>
            </div>
            <SyntaxHighlighter language={lang || 'text'} style={oneDark}
                customStyle={{ margin: 0, padding: '10px 12px', fontSize: '12.5px', borderRadius: 0 }} wrapLongLines>
                {code}
            </SyntaxHighlighter>
            {run && run !== 'running' && (
                <pre data-testid="code-output" style={{ margin: 0, padding: '8px 12px', fontSize: '12px', background: '#111', color: run.status === 'ok' ? '#c8e6c9' : '#ffab91', borderTop: '1px solid var(--border-default)', whiteSpace: 'pre-wrap' }}>
                    {run.output.length ? run.output.map((o) => (o.level === 'result' ? `⇒ ${o.text}` : o.text)).join('\n') : '(no output)'}
                </pre>
            )}
        </div>
    );
}
