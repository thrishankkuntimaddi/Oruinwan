import React from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import CodeBlock from './CodeBlock';
import { linkMentions, mentionFromHref } from '../../../utils/linkMentions';
import { useAuth } from '../../../contexts/AuthContext';

// Renderers are defined once, at module level. Creating them inside the component
// gave React new component types on every render, remounting code blocks (and
// losing, for example, the output of a sandbox run).

function MarkdownLink({ node, href, children, ...props }) {
    const auth = useAuth?.();
    const mention = mentionFromHref(href);
    if (mention) {
        const me = auth?.user?.username || '';
        const broadcast = mention === 'here' || mention === 'channel';
        const self = me && mention.toLowerCase() === me.toLowerCase();
        return (
            <span data-mention={mention}
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[13px] font-semibold cursor-default select-none ${broadcast
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                    : self ? 'bg-blue-200 text-blue-800 dark:bg-blue-800/60 dark:text-blue-200 ring-1 ring-blue-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'}`}>
                {children}
            </span>
        );
    }
    return (
        <a {...props} href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}
            onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
            onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}>
            {children}
        </a>
    );
}

function MarkdownCode({ node, className, children, ...props }) {
    const match = /language-([\w+-]+)/.exec(className || '');
    const content = String(children).replace(/\n$/, '');
    if (!match && !content.includes('\n')) {
        return <code {...props} style={{ background: 'var(--bg-active)', padding: '1px 4px', borderRadius: '2px', fontSize: '0.9em' }}>{children}</code>;
    }
    return <CodeBlock language={match?.[1]} code={content} />;
}

const COMPONENTS = {
    a: MarkdownLink,
    code: MarkdownCode,
    pre: ({ children }) => <>{children}</>,
    ul: ({ node, ...props }) => <ul {...props} style={{ listStyleType: 'disc', paddingLeft: '18px', margin: '4px 0' }} />,
    ol: ({ node, ...props }) => <ol {...props} style={{ listStyleType: 'decimal', paddingLeft: '18px', margin: '4px 0' }} />,
    table: ({ node, ...props }) => <table {...props} style={{ borderCollapse: 'collapse', margin: '6px 0', fontSize: '13px' }} />,
    th: ({ node, ...props }) => <th {...props} style={{ border: '1px solid var(--border-default)', padding: '4px 8px', textAlign: 'left', background: 'var(--bg-active)' }} />,
    td: ({ node, ...props }) => <td {...props} style={{ border: '1px solid var(--border-default)', padding: '4px 8px' }} />,
};

const REMARK_PLUGINS = [remarkGfm, remarkBreaks];

// Keep mention: links; everything else goes through the normal safe URL filter.
const urlTransform = (url) => (url.startsWith('mention:') ? url : defaultUrlTransform(url));

/**
 * Markdown for chat messages: GFM (tables, task lists, strikethrough), line breaks,
 * highlighted code blocks with copy/run, and @mention chips.
 */
function MessageMarkdown({ text }) {
    return (
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS} urlTransform={urlTransform}>
            {linkMentions(text)}
        </ReactMarkdown>
    );
}

export default React.memo(MessageMarkdown);
