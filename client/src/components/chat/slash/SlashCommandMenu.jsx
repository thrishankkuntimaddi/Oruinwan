import React, { useEffect, useRef, useState } from "react";
import { SLASH_COMMAND_CATEGORIES, runsWithoutArgs } from "./slashCommands";
import SlashCommandItem from "./SlashCommandItem";

/**
 * The list shown while typing "/name". ↑↓ (or hover) picks, Tab fills the name, Enter runs a
 * command that needs nothing more (otherwise fills it), a click does the same as Enter.
 * items: the commands to show, already filtered. onPick(command, { run }).
 */
export default function SlashCommandMenu({ items = [], query = "/", onPick, onClose }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeItemRef = useRef(null);
  // Grouped order is the order shown (and the order the arrow keys walk).
  const grouped = SLASH_COMMAND_CATEGORIES
    .map((cat) => ({ ...cat, commands: items.filter((c) => c.category === cat.id) }))
    .filter((cat) => cat.commands.length > 0);
  const flat = grouped.flatMap((g) => g.commands);
  const key = flat.map((c) => c.name).join(",");

  useEffect(() => { setActiveIdx(0); }, [key]);
  useEffect(() => {
    activeItemRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [activeIdx]);

  const pick = (command, viaTab = false) => onPick?.(command, { run: !viaTab && runsWithoutArgs(command) });

  SlashCommandMenu.handleKey = (e) => {
    if (!flat.length) return false;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % flat.length); return true; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => (i - 1 + flat.length) % flat.length); return true; }
    if (e.key === "Tab") { e.preventDefault(); if (flat[activeIdx]) pick(flat[activeIdx], true); return true; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (flat[activeIdx]) pick(flat[activeIdx]); return true; }
    if (e.key === "Escape") { onClose?.(); return true; }
    return false;
  };

  if (!flat.length) {
    return (
      <div className="gl-liquid gl-liquid--strong anim-pop-in" data-testid="slash-menu" style={{ width: '100%', borderRadius: 'var(--gl-radius-md)', padding: '14px 16px' }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          No command called <code style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{String(query).split(/\s+/)[0]}</code>. Type /help to see them all.
        </p>
      </div>
    );
  }

  let flatIdx = 0;
  return (
    <div
      onMouseDown={(e) => e.preventDefault()}
      className="gl-liquid gl-liquid--strong anim-pop-in"
      data-testid="slash-menu"
      role="listbox"
      aria-label="Commands"
      style={{ width: '100%', borderRadius: 'var(--gl-radius-md)', overflow: 'hidden' }}
    >
      <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 6px' }}>
        {grouped.map((cat) => (
          <div key={cat.id}>
            <div style={{ padding: '6px 8px 3px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{cat.label}</span>
            </div>
            {cat.commands.map((cmd) => {
              const thisIdx = flatIdx++;
              return (
                <div key={cmd.name} ref={thisIdx === activeIdx ? activeItemRef : null}>
                  <SlashCommandItem
                    command={cmd}
                    isActive={thisIdx === activeIdx}
                    onSelect={() => pick(cmd)}
                    onHover={() => setActiveIdx(thisIdx)}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-active)' }}>
        {[['↑↓', 'choose'], ['Tab', 'fill'], ['↵', 'run'], ['Esc', 'close']].map(([k, label]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            <kbd style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', borderRadius: 2, padding: '1px 4px', fontSize: 10, fontFamily: 'monospace' }}>{k}</kbd>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
