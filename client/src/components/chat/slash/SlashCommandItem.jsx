import React from "react";
import { CornerDownLeft } from "lucide-react";

export default function SlashCommandItem({ command, isActive, onSelect, onHover }) {
  const [hovered, setHovered] = React.useState(false);
  const active = isActive || hovered;

  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onSelect(command); }}
      onMouseEnter={() => { setHovered(true); onHover?.(command); }}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '7px 10px', textAlign: 'left', border: 'none',
        backgroundColor: active ? 'var(--bg-hover)' : 'transparent',
        borderRadius: '2px', cursor: 'pointer',
        transition: 'background-color 150ms ease',
      }}
    >
      {/* Emoji icon */}
      <div style={{
        width: 30, height: 30, borderRadius: '2px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '15px', flexShrink: 0,
        backgroundColor: active ? 'var(--bg-active)' : 'var(--bg-active)',
        border: '1px solid var(--border-subtle)',
      }}>
        {command.emoji}
      </div>

      {/* Command + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '12px', fontFamily: 'monospace', fontWeight: 700,
            color: active ? 'var(--accent)' : 'var(--text-primary)',
          }}>{command.command}</span>
          <span style={{
            fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.12em', color: 'var(--text-muted)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}>{command.label}</span>
        </div>
        <p style={{
          fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '1px 0 0',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}>{command.description}</p>
      </div>

      {/* Enter hint */}
      <CornerDownLeft size={12} style={{
        flexShrink: 0, color: 'var(--accent)',
        opacity: active ? 1 : 0,
        transition: 'opacity 150ms ease',
      }} />
    </button>
  );
}
