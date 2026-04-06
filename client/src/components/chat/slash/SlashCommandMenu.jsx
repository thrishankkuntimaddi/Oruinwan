import React, { useEffect, useRef, useState } from "react";
import { SLASH_COMMANDS, SLASH_COMMAND_CATEGORIES, filterSlashCommands } from "./mockSlashCommands";
import SlashCommandItem from "./SlashCommandItem";

export default function SlashCommandMenu({ query, onSelect, onClose, onPreviewChange }) {
  const filtered = filterSlashCommands(query);
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef(null);
  const activeItemRef = useRef(null);

  useEffect(() => {
    const clamped = Math.min(activeIdx, Math.max(filtered.length - 1, 0));
    setActiveIdx(clamped);
    onPreviewChange?.(filtered[clamped] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    onPreviewChange?.(filtered[activeIdx] ?? null);
  }, [activeIdx, filtered, onPreviewChange]);

  SlashCommandMenu.handleKey = (e) => {
    if (!filtered.length) return false;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % filtered.length); return true; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length); return true; }
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); if (filtered[activeIdx]) onSelect(filtered[activeIdx]); return true; }
    if (e.key === "Escape") { onClose?.(); return true; }
    return false;
  };

  if (!filtered.length) {
    return (
      <div style={{
        width: '100%', backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-accent)', borderRadius: '2px',
        padding: '20px', textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
          No commands match <code style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{query}</code>
        </p>
      </div>
    );
  }

  const grouped = SLASH_COMMAND_CATEGORIES
    .map((cat) => ({ ...cat, commands: filtered.filter((cmd) => cmd.category === cat.id) }))
    .filter((cat) => cat.commands.length > 0);

  let flatIdx = 0;

  return (
    <div
      onMouseDown={(e) => e.preventDefault()}
      style={{
        width: '100%', backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-accent)', borderRadius: '2px',
        overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px',
        backgroundColor: 'var(--bg-active)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.14em',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}>Commands</span>
          {query && query !== "/" && (
            <span style={{
              fontFamily: 'monospace', fontSize: '11px',
              color: 'var(--accent)',
              backgroundColor: 'rgba(184,149,106,0.1)',
              padding: '1px 6px', borderRadius: '2px',
            }}>{query}</span>
          )}
        </div>
        <button
          onMouseDown={(e) => { e.preventDefault(); onClose?.(); }}
          style={{
            color: 'var(--text-muted)', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: '12px', padding: '2px 4px',
            transition: 'color 150ms ease',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          title="Close (Esc)"
        >✕</button>
      </div>

      {/* List */}
      <div ref={listRef} style={{ maxHeight: '260px', overflowY: 'auto', padding: '4px 6px' }}>
        {grouped.map((cat) => (
          <div key={cat.id}>
            <div style={{ padding: '6px 8px 3px' }}>
              <span style={{
                fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.14em',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              }}>{cat.label}</span>
            </div>
            {cat.commands.map((cmd) => {
              const thisIdx = flatIdx++;
              return (
                <div key={cmd.command} ref={thisIdx === activeIdx ? activeItemRef : null}>
                  <SlashCommandItem
                    command={cmd}
                    isActive={thisIdx === activeIdx}
                    onSelect={onSelect}
                    onHover={() => setActiveIdx(thisIdx)}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '6px 12px',
        borderTop: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-active)',
      }}>
        {[['↑↓', 'navigate'], ['↵', 'select'], ['Esc', 'close']].map(([key, label]) => (
          <span key={key} style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '10px', color: 'var(--text-muted)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}>
            <kbd style={{
              backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)',
              borderRadius: '2px', padding: '1px 4px', fontSize: '9px', fontFamily: 'monospace',
            }}>{key}</kbd>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
