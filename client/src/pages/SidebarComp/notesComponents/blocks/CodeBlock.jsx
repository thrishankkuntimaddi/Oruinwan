import React, { useState } from 'react';
import { Trash2, Copy, Check, ChevronDown } from 'lucide-react';

const LANGUAGES = [
    'javascript', 'typescript', 'python', 'bash', 'json',
    'html', 'css', 'sql', 'java', 'go', 'rust', 'c', 'cpp', 'plaintext'
];

// Language marks keep their familiar syntax colours (the only colours in the block); the block itself uses theme tokens.
const LANG_COLORS = {
    javascript: '#f7df1e', typescript: '#3178c6', python: '#3776ab', bash: '#4eaa25',
    json: '#a97dff', html: '#e34c26', css: '#264de4', sql: '#336791',
    java: '#b07219', go: '#00acd7', rust: '#ce422b', c: '#555555', cpp: '#f34b7d', plaintext: 'var(--text-secondary)'
};

const CodeBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const [copied, setCopied] = useState(false);
    const [showLangPicker, setShowLangPicker] = useState(false);
    const lang = block.meta?.lang || 'javascript';
    const dotColor = LANG_COLORS[lang] || 'var(--text-secondary)';

    const handleCopy = async () => {
        await navigator.clipboard.writeText(block.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const setLang = (l) => {
        onBlockChange(block.id, block.content, { ...block.meta, lang: l });
        setShowLangPicker(false);
    };

    return (
        <div className="group relative mb-4">
            <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--gl-radius)', overflow: 'hidden' }}>
                {}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 6px 14px', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {}
                        {}
                        <div style={{ position: 'relative' }}>
                            <button
                                type="button"
                                onClick={() => setShowLangPicker(v => !v)}
                                aria-expanded={showLangPicker}
                                aria-label={`Language: ${lang}`}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 150ms ease' }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                            >
                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, background: dotColor }} />
                                {lang}
                                <ChevronDown size={9} style={{ transition: 'transform 200ms ease', transform: showLangPicker ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                            </button>
                            {showLangPicker && (
                                <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--card-shadow)', zIndex: 30, maxHeight: '200px', overflowY: 'auto', minWidth: '140px', padding: '4px 0' }}>
                                    {LANGUAGES.map(l => (
                                        <button
                                            key={l}
                                            onClick={() => setLang(l)}
                                            style={{ width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: '11px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '8px', background: l === lang ? 'var(--accent-dim)' : 'transparent', color: l === lang ? 'var(--accent)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', transition: 'background 100ms ease' }}
                                            onMouseEnter={e => { if (l !== lang) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                            onMouseLeave={e => { if (l !== lang) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: LANG_COLORS[l] || 'var(--text-secondary)' }} />
                                            {l}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" onClick={handleCopy}
                            style={copied ? { color: 'var(--state-success)' } : undefined}>
                            {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                        </button>
                        <button type="button" className="gl-icon-btn gl-x-danger group-hover:!opacity-100" style={{ opacity: 0 }}
                            onClick={() => onRemoveBlock(block.id)} aria-label="Remove code block" title="Remove code block">
                            <Trash2 size={13} />
                        </button>
                    </div>
                </div>

                {}
                <div style={{ position: 'relative', background: 'var(--bg-surface)' }}>
                    {}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '40px', background: 'var(--bg-hover)', borderRight: '1px solid var(--border-subtle)', pointerEvents: 'none' }} />
                    <textarea
                        value={block.content}
                        onChange={e => onBlockChange(block.id, e.target.value, block.meta)}
                        spellCheck={false}
                        placeholder={`Paste or write ${lang} code`}
                        className="note-code-textarea"
                        style={{
                            width: '100%', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '12.5px',
                            color: 'var(--text-primary)', background: 'transparent', border: 'none', padding: '14px 14px 14px 54px',
                            outline: 'none', resize: 'none', minHeight: '110px', lineHeight: 1.75,
                            letterSpacing: '0.01em', boxSizing: 'border-box', tabSize: 2,
                            caretColor: 'var(--accent)',
                        }}
                        onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    />
                </div>
            </div>
        </div>
    );
};

export default CodeBlock;
