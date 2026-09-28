import React from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { TextBlockView } from './TextBlock';
import ImageBlock from './ImageBlock';
import VideoBlock from './VideoBlock';
import AudioBlock from './AudioBlock';
import FileBlock from './FileBlock';

const HEADING_SIZES = { 1: '2.25rem', 2: '1.75rem', 3: '1.375rem', 4: '1.125rem' };
const parse = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
const noop = () => {};

/**
 * Static rendering of a note block for people who may view but not edit the note.
 * No inputs, no contentEditable, so nothing is ever saved from this view.
 */
const ReadOnlyBlock = ({ block, mediaProps }) => {
    const text = { color: 'var(--text-primary)', fontFamily: 'var(--font)' };
    switch (block.type) {
        case 'text':
            return <TextBlockView block={block} />;
        case 'heading': {
            const level = block.meta?.level || 1;
            const Tag = `h${Math.min(Math.max(level, 1), 4)}`;
            return block.content ? <Tag style={{ ...text, fontSize: HEADING_SIZES[level] || HEADING_SIZES[1], fontWeight: level <= 1 ? 800 : level === 2 ? 700 : 600, lineHeight: 1.2, margin: '0 0 12px' }}>{block.content}</Tag> : null;
        }
        case 'code':
            return (
                <pre style={{ margin: '0 0 16px', padding: '14px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '13px', lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', overflowX: 'auto', fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace" }}>
                    <code>{block.content}</code>
                </pre>
            );
        case 'callout':
            return block.content ? (
                <div style={{ ...text, margin: '0 0 12px', padding: '12px 16px', background: 'var(--accent-dim)', borderLeft: '3px solid var(--accent)', borderRadius: '2px', fontSize: '14px', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{block.content}</div>
            ) : null;
        case 'checklist': {
            const items = parse(block.content, []);
            return (
                <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0 }}>
                    {(Array.isArray(items) ? items : []).map((it, i) => (
                        <li key={it.id ?? i} style={{ ...text, display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '3px 0', fontSize: '14px', color: it.done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: it.done ? 'line-through' : 'none' }}>
                            {it.done ? <CheckSquare size={15} style={{ color: 'var(--accent)', marginTop: '3px', flexShrink: 0 }} /> : <Square size={15} style={{ color: 'var(--text-muted)', marginTop: '3px', flexShrink: 0 }} />}
                            <span>{it.text}</span>
                        </li>
                    ))}
                </ul>
            );
        }
        case 'toggle':
            return (
                <details open={!!block.meta?.open} style={{ margin: '0 0 8px', border: '1px solid var(--border-default)', borderRadius: '2px' }}>
                    <summary style={{ ...text, padding: '10px 12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>{block.meta?.title || 'Toggle'}</summary>
                    <div style={{ ...text, padding: '10px 16px 14px', borderTop: '1px solid var(--border-subtle)', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{block.content}</div>
                </details>
            );
        case 'divider':
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }} />
                    {block.content && <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{block.content}</span>}
                    {block.content && <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }} />}
                </div>
            );
        case 'table': {
            const t = parse(block.content, { headers: [], rows: [] }) || {};
            const cell = { padding: '8px 12px', border: '1px solid var(--border-default)', textAlign: 'left', fontSize: '13px', color: 'var(--text-primary)' };
            return (
                <div style={{ overflowX: 'auto', margin: '0 0 16px' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'var(--font)' }}>
                        <thead><tr>{(t.headers || []).map((h, i) => <th key={i} style={{ ...cell, background: 'var(--bg-surface)', fontWeight: 600 }}>{h}</th>)}</tr></thead>
                        <tbody>{(t.rows || []).map((r, ri) => <tr key={ri}>{(r || []).map((c, ci) => <td key={ci} style={cell}>{c}</td>)}</tr>)}</tbody>
                    </table>
                </div>
            );
        }
        case 'image': return <ImageBlock block={block} {...mediaProps} onBlockChange={noop} onRemoveBlock={noop} readOnly />;
        case 'video': return <VideoBlock block={block} {...mediaProps} onBlockChange={noop} onRemoveBlock={noop} readOnly />;
        case 'audio': return <AudioBlock block={block} {...mediaProps} onBlockChange={noop} onRemoveBlock={noop} readOnly />;
        case 'file': return <FileBlock block={block} {...mediaProps} onBlockChange={noop} onRemoveBlock={noop} readOnly />;
        default: return null;
    }
};

export default ReadOnlyBlock;
