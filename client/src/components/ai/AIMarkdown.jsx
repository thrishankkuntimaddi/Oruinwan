import React, { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';
import './aiMarkdown.css';

/** Fenced code block with a language label and a copy button. */
const CodeBlock = ({ className, children }) => {
    const [copied, setCopied] = useState(false);
    const lang = /language-([\w+-]+)/.exec(className || '')?.[1];
    const code = String(children).replace(/\n$/, '');
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard unavailable: ignore */ }
    };
    return (
        <div className="aimd-code">
            <div className="aimd-code__bar">
                <span>{lang || 'code'}</span>
                <button type="button" onClick={copy} aria-label="Copy code">
                    {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre><code>{code}</code></pre>
        </div>
    );
};

const components = {
    // Block code arrives as <pre><code class="language-x">; inline code has no <pre> parent.
    pre: ({ children }) => {
        const child = Array.isArray(children) ? children[0] : children;
        return <CodeBlock className={child?.props?.className}>{child?.props?.children}</CodeBlock>;
    },
    code: ({ className, children }) => <code className={className}>{children}</code>,
    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    table: ({ children }) => <div className="aimd-table"><table>{children}</table></div>,
};

/**
 * Renders an AI answer as Markdown (GFM). Raw HTML in model output is not
 * rendered. While `streaming`, a caret is shown after the text.
 */
const AIMarkdown = ({ text, streaming = false }) => (
    <div className={`aimd${streaming ? ' aimd--streaming' : ''}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {text || ''}
        </ReactMarkdown>
        {streaming && <span className="aimd-caret" aria-hidden="true" />}
    </div>
);

export default memo(AIMarkdown);
