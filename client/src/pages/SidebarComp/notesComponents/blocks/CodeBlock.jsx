import React, { useState } from 'react';
import { Trash2, Copy, Check, ChevronDown } from 'lucide-react';

const LANGUAGES = [
    'javascript', 'typescript', 'python', 'bash', 'json',
    'html', 'css', 'sql', 'java', 'go', 'rust', 'c', 'cpp', 'plaintext'
];

const LANG_COLORS = {
    javascript: '#f7df1e', typescript: '#3178c6', python: '#3776ab', bash: '#4eaa25',
    json: '#a97dff', html: '#e34c26', css: '#264de4', sql: '#336791',
    java: '#b07219', go: '#00acd7', rust: '#ce422b', c: '#555555', cpp: '#f34b7d', plaintext: '#888'
};

const CodeBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const [copied, setCopied] = useState(false);
    const [showLangPicker, setShowLangPicker] = useState(false);
    const lang = block.meta?.lang || 'javascript';
    const dotColor = LANG_COLORS[lang] || '#888';

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
            <div style={{ border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                {/* Header bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#161616', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Traffic lights */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#ff5f57' }} />
                            <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#febc2e' }} />
                            <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#28c840' }} />
                        </div>
                        <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.08)' }} />
                        {/* Language picker */}
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowLangPicker(v => !v)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600, color: 'rgba(228,228,228,0.5)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 150ms ease' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.5)'}
                            >
                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, background: dotColor }} />
                                {lang}
                                <ChevronDown size={9} style={{ transition: 'transform 200ms ease', transform: showLangPicker ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                            </button>
                            {showLangPicker && (
                                <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: '6px', background: '#161616', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 16px 50px rgba(0,0,0,0.7)', zIndex: 30, maxHeight: '200px', overflowY: 'auto', minWidth: '140px', padding: '4px 0' }}>
                                    {LANGUAGES.map(l => (
                                        <button
                                            key={l}
                                            onClick={() => setLang(l)}
                                            style={{ width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: '11px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '8px', background: l === lang ? 'rgba(184,149,106,0.1)' : 'transparent', color: l === lang ? '#b8956a' : 'rgba(228,228,228,0.5)', border: 'none', cursor: 'pointer', transition: 'background 100ms ease' }}
                                            onMouseEnter={e => { if (l !== lang) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                                            onMouseLeave={e => { if (l !== lang) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: LANG_COLORS[l] || '#888' }} />
                                            {l}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                            onClick={handleCopy}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 500,
                                padding: '4px 10px', background: copied ? 'rgba(52,211,153,0.1)' : 'transparent',
                                color: copied ? '#34d399' : 'rgba(228,228,228,0.4)', border: `1px solid ${copied ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.08)'}`,
                                cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'monospace',
                            }}
                            onMouseEnter={e => { if (!copied) { e.currentTarget.style.color = '#e4e4e4'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; } }}
                            onMouseLeave={e => { if (!copied) { e.currentTarget.style.color = 'rgba(228,228,228,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; } }}
                        >
                            {copied ? <><Check size={11} />Copied</> : <><Copy size={11} />Copy</>}
                        </button>
                        <button
                            onClick={() => onRemoveBlock(block.id)}
                            style={{ padding: '5px', color: 'rgba(228,228,228,0.2)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0, transition: 'all 150ms ease' }}
                            className="group-hover:!opacity-100"
                            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.2)'}
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>

                {/* Code area */}
                <div style={{ position: 'relative', background: '#0e0e0e' }}>
                    {/* Line number gutter stripe */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '40px', background: 'rgba(255,255,255,0.015)', borderRight: '1px solid rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
                    <textarea
                        value={block.content}
                        onChange={e => onBlockChange(block.id, e.target.value, block.meta)}
                        spellCheck={false}
                        placeholder={`// ${lang} code...`}
                        style={{
                            width: '100%', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '12.5px',
                            color: '#e4e4e4', background: 'transparent', padding: '14px 14px 14px 54px',
                            outline: 'none', resize: 'none', minHeight: '110px', lineHeight: 1.75,
                            letterSpacing: '0.01em', boxSizing: 'border-box', tabSize: 2,
                        }}
                        onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    />
                </div>
            </div>
        </div>
    );
};

export default CodeBlock;
