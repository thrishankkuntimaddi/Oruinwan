import React from "react";

export default function EmojiPicker({ onPick }) {
  const EMOJIS = [
    "😀", "😁", "😂", "🤣", "😅", "😊", "😍", "😘", "😎", "🤔", "🤩", "🙌",
    "👍", "👎", "👏", "🙏", "🔥", "🎉", "😢", "😮", "😴", "🤯", "🤝", "💯",
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔", "❣️", "💕", "💞", "💓",
    "💪", "🧠", "👀", "👁️", "👄", "💋", "👅", "👃", "👂", "🦶", "🦵", "🖕",
    "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙"
  ];

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-accent)',
        borderRadius: '2px',
        width: '280px',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        fontFamily: 'var(--font)',
      }}
    >
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-active)' }}>
        <h3 style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.14em', margin: 0 }}>
          Pick an emoji
        </h3>
      </div>

      <div style={{ padding: '6px', display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2px', maxHeight: '200px', overflowY: 'auto' }} className="custom-scrollbar">
        {EMOJIS.map(em => (
          <button
            key={em}
            onClick={() => onPick(em)}
            style={{
              width: '30px', height: '30px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '16px', borderRadius: '2px',
              background: 'none', border: 'none', cursor: 'pointer',
              transition: '150ms ease',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {em}
          </button>
        ))}
      </div>
    </div>
  );
}
