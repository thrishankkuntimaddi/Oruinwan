import React, { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Info, Lightbulb, AlertTriangle, ArrowRight, Link2 } from 'lucide-react';
import { CodeBlock, CodeTabs } from './DocsCode';
import DocsFigure from './DocsFigures';
import { headingsOf } from '../../content/docs';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
const KEY_LABEL = { Mod: IS_MAC ? '⌘' : 'Ctrl', Shift: IS_MAC ? '⇧' : 'Shift', Alt: IS_MAC ? '⌥' : 'Alt', Enter: 'Enter', Esc: 'Esc' };
const KEY_NAME = { Mod: IS_MAC ? 'Command' : 'Control', Shift: 'Shift', Alt: IS_MAC ? 'Option' : 'Alt' };

/** One key combination, e.g. ['Mod', 'K'] → ⌘ K chips. */
export const Keys = ({ keys }) => (
    <span className="docs-keys" aria-label={keys.map((k) => KEY_NAME[k] || k).join(' + ')}>
        {keys.map((k, i) => <kbd key={i} className="orw-kbd" aria-hidden="true">{KEY_LABEL[k] || k}</kbd>)}
    </span>
);

function DocLink({ href, children }) {
    if (href.startsWith('/')) return <Link to={href}>{children}</Link>;
    if (href.startsWith('#')) return <a href={href}>{children}</a>;
    return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\]|\[[^\]]+\]\([^)\s]+\))/g;

/** Render inline markup: **bold**, `code`, [label](href), [[Mod+K]]. */
export function Inline({ text }) {
    const parts = String(text ?? '').split(INLINE);
    return parts.map((p, i) => {
        if (!p) return null;
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith('`') && p.endsWith('`') && p.length > 2) return <code key={i}>{p.slice(1, -1)}</code>;
        if (p.startsWith('[[') && p.endsWith(']]')) return <Keys key={i} keys={p.slice(2, -2).split('+')} />;
        const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(p);
        if (m) return <DocLink key={i} href={m[2]}><Inline text={m[1]} /></DocLink>;
        return <Fragment key={i}>{p}</Fragment>;
    });
}

const CALLOUT = {
    tip: { icon: Lightbulb, label: 'Tip' },
    note: { icon: Info, label: 'Note' },
    warning: { icon: AlertTriangle, label: 'Warning' },
};

function Heading({ level, id, text }) {
    const Tag = level === 2 ? 'h2' : 'h3';
    const copy = (e) => {
        e.preventDefault();
        const url = `${window.location.origin}${window.location.pathname}#${id}`;
        window.history.replaceState(null, '', `#${id}`);
        document.getElementById(id)?.scrollIntoView({ block: 'start' });
        navigator.clipboard?.writeText(url).catch(() => {});
        const el = e.currentTarget;
        el.classList.add('is-copied');
        setTimeout(() => el.classList.remove('is-copied'), 1400);
    };
    return (
        <Tag id={id} className={`docs-h docs-h--${level}`} tabIndex={-1}>
            <Inline text={text} />
            <a href={`#${id}`} className="docs-anchor" onClick={copy} aria-label={`Copy link to “${text.replace(/[`*]/g, '')}”`}>
                <Link2 size={14} aria-hidden="true" />
                <span className="docs-anchor__done" aria-hidden="true">Link copied</span>
            </a>
        </Tag>
    );
}

/** Render one page's blocks. Headings get the same ids as headingsOf(page). */
export default function DocsBlocks({ page }) {
    const heads = headingsOf(page);
    let hi = 0;
    return page.blocks.map((b, i) => {
        if (typeof b === 'string') return <p key={i} data-docs-reveal><Inline text={b} /></p>;
        if (b.h || b.h3) {
            const h = heads[hi++];
            return <Heading key={i} level={h.level} id={h.id} text={h.text} />;
        }
        if (b.list) {
            return <ul key={i} className="docs-list" data-docs-reveal>{b.list.map((t, j) => <li key={j}><Inline text={t} /></li>)}</ul>;
        }
        if (b.steps) {
            return <ol key={i} className="docs-steps" data-docs-reveal>{b.steps.map((t, j) => <li key={j}><Inline text={t} /></li>)}</ol>;
        }
        if (b.callout) {
            const c = CALLOUT[b.callout] || CALLOUT.note;
            const Icon = c.icon;
            return (
                <aside key={i} className={`docs-callout docs-callout--${b.callout}`} data-docs-reveal aria-label={b.title || c.label}>
                    <Icon size={16} aria-hidden="true" />
                    <div>
                        <p className="docs-callout__title">{b.title ? <Inline text={b.title} /> : c.label}</p>
                        <p><Inline text={b.text} /></p>
                    </div>
                </aside>
            );
        }
        if (b.table) {
            return (
                <div key={i} className="docs-table" data-docs-reveal role="region" aria-label={b.table.caption || 'Table'} tabIndex={0}>
                    <table>
                        {b.table.caption && <caption className="orw-sr">{b.table.caption}</caption>}
                        <thead><tr>{b.table.head.map((t, j) => <th key={j} scope="col"><Inline text={t} /></th>)}</tr></thead>
                        <tbody>
                            {b.table.rows.map((r, j) => <tr key={j}>{r.map((t, k) => <td key={k}><Inline text={t} /></td>)}</tr>)}
                        </tbody>
                    </table>
                </div>
            );
        }
        if (b.code) return <div key={i} data-docs-reveal><CodeBlock code={b.code} lang={b.lang} title={b.title} /></div>;
        if (b.codeTabs) return <div key={i} data-docs-reveal><CodeTabs tabs={b.codeTabs} /></div>;
        if (b.figure) return <DocsFigure key={i} id={b.figure} caption={b.caption} />;
        if (b.shortcuts) {
            return (
                <dl key={i} className="docs-shortcuts" data-docs-reveal>
                    {b.shortcuts.map((s, j) => (
                        <div key={j} className="docs-shortcuts__row">
                            <dt><Inline text={s.label} />{s.where && <span className="docs-shortcuts__where"> ({s.where})</span>}</dt>
                            <dd>{s.keys.map((k, n) => <Fragment key={n}>{n > 0 && <span className="docs-shortcuts__or">or</span>}<Keys keys={k} /></Fragment>)}</dd>
                        </div>
                    ))}
                </dl>
            );
        }
        if (b.cards) {
            return (
                <ul key={i} className="docs-cards" data-docs-reveal>
                    {b.cards.map((c) => (
                        <li key={c.to}>
                            <Link to={c.to} className="docs-card">
                                <span className="docs-card__title">{c.title}<ArrowRight size={14} aria-hidden="true" /></span>
                                {c.text && <span className="docs-card__text"><Inline text={c.text} /></span>}
                            </Link>
                        </li>
                    ))}
                </ul>
            );
        }
        return null;
    });
}
