import React from 'react';

/** "Alex is typing…" line shown between the message list and the composer. */
function describe(users) {
  const names = users.map((u) => u.name || 'Someone');
  if (names.length === 1) return <><strong>{names[0]}</strong> is typing</>;
  if (names.length === 2) return <><strong>{names[0]}</strong> and <strong>{names[1]}</strong> are typing</>;
  return <><strong>{names[0]}</strong> and {names.length - 1} others are typing</>;
}

export default function TypingIndicator({ users = [] }) {
  const visible = users.length > 0;
  return (
    <div
      aria-live="polite"
      style={{
        // Reserve the row so the composer never jumps when someone starts typing.
        height: '22px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0 20px',
        fontSize: '12px',
        color: 'var(--text-muted)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 150ms ease',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {visible && (
        <>
          <span style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                style={{
                  width: '4px', height: '4px', borderRadius: '50%',
                  backgroundColor: 'var(--accent)', display: 'inline-block',
                  animation: 'bounce 1.2s ease infinite', animationDelay: `${delay}ms`,
                }}
              />
            ))}
          </span>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {describe(users)}…
          </span>
        </>
      )}
    </div>
  );
}
