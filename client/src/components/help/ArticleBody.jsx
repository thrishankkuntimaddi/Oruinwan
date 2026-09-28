import React from 'react';

/** Renders **bold** and `code` inside a help sentence. */
export function RichText({ text }) {
    const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
    return parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>;
        return <React.Fragment key={i}>{p}</React.Fragment>;
    });
}

/**
 * Body blocks of a help article: a string is a paragraph, { steps: [] } an
 * ordered list, { list: [] } a bullet list, { note: '' } a highlighted tip.
 * `classes` lets the public page and the in-app panel style it their own way.
 */
export default function ArticleBody({ body, classes = {} }) {
    return (body || []).map((block, i) => {
        if (typeof block === 'string') return <p key={i} className={classes.p}><RichText text={block} /></p>;
        if (block.steps) {
            return (
                <ol key={i} className={classes.steps}>
                    {block.steps.map((s, j) => <li key={j}><RichText text={s} /></li>)}
                </ol>
            );
        }
        if (block.list) {
            return (
                <ul key={i} className={classes.list}>
                    {block.list.map((s, j) => <li key={j}><RichText text={s} /></li>)}
                </ul>
            );
        }
        if (block.note) return <p key={i} className={classes.note}><RichText text={block.note} /></p>;
        return null;
    });
}
