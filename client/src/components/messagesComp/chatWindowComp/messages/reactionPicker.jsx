import React, { useState, useRef, useEffect } from "react";
import EmojiPicker from "emoji-picker-react";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

export default function ReactionPicker({ onSelect, onClose }) {
    const [showFull, setShowFull] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onClose?.();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    return (
        <div ref={ref} style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            {}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '2px',
                backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-accent)',
                borderRadius: '99px', padding: '3px 6px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            }}>
                {QUICK_REACTIONS.map(emoji => (
                    <button
                        key={emoji}
                        onClick={() => { onSelect(emoji); onClose?.(); }}
                        style={{
                            padding: '4px', background: 'none', border: 'none',
                            cursor: 'pointer', fontSize: '17px', borderRadius: '99px',
                            transition: '150ms ease', lineHeight: 1,
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        {emoji}
                    </button>
                ))}
                {}
                <button
                    onClick={() => setShowFull(s => !s)}
                    title="More reactions"
                    style={{
                        padding: '4px 7px', background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                        color: 'var(--text-muted)', borderRadius: '99px', transition: '150ms ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                    +
                </button>
            </div>

            {}
            {showFull && (
                <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, zIndex: 50, borderRadius: '2px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                    <EmojiPicker
                        onEmojiClick={data => { onSelect(data.emoji); onClose?.(); }}
                        height={360} width={300}
                        skinTonesDisabled
                        previewConfig={{ showPreview: false }}
                        theme="dark"
                    />
                </div>
            )}
        </div>
    );
}
