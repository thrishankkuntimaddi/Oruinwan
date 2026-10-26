import React from "react";
import { X } from "lucide-react";

const box = (tone) => ({
  width: '100%', borderRadius: 'var(--gl-radius-md)', padding: '10px 12px',
  display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13,
  border: `1px solid ${tone === 'error' ? 'var(--state-danger, #c0392b)' : 'var(--border-subtle)'}`,
});
const code = { fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)' };
const closeBtn = (onClose) => onClose && (
  <button type="button" className="gl-icon-btn" aria-label="Close" title="Close (Esc)"
    onMouseDown={(e) => { e.preventDefault(); onClose(); }} style={{ width: 24, height: 24, flexShrink: 0 }}>
    <X size={13} />
  </button>
);

/**
 * Above the composer, for slash commands:
 *   { kind: 'hint', usage, description, unavailable }   while typing a command's arguments
 *   { kind: 'error', message }                          the command can't run as typed
 *   { kind: 'unknown', name }                           not a command: send as text?
 *   { kind: 'help', lines }                             /help
 */
export default function SlashNotice({ notice, onClose, onSendAsText, onEdit }) {
  if (!notice) return null;
  if (notice.kind === 'hint') {
    return (
      <div className="gl-liquid gl-liquid--strong anim-fade-in" style={box()} data-testid="slash-hint" role="status">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={code}>{notice.usage}</div>
          <div style={{ color: notice.unavailable ? 'var(--state-danger, #c0392b)' : 'var(--text-secondary)', marginTop: 2 }}>
            {notice.unavailable || notice.description}
          </div>
        </div>
      </div>
    );
  }
  if (notice.kind === 'error') {
    return (
      <div className="gl-liquid gl-liquid--strong anim-pop-in" style={box('error')} data-testid="slash-error" role="alert">
        <div style={{ flex: 1, minWidth: 0, color: 'var(--text-primary)' }}>{notice.message}</div>
        {closeBtn(onClose)}
      </div>
    );
  }
  if (notice.kind === 'unknown') {
    return (
      <div className="gl-liquid gl-liquid--strong anim-pop-in" style={{ ...box(), alignItems: 'center' }} data-testid="slash-unknown" role="alert">
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={code}>/{notice.name}</span> isn't a command. Send as text?
        </div>
        <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" onMouseDown={(e) => { e.preventDefault(); onEdit?.(); }}>Edit</button>
        <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" data-testid="slash-send-as-text" onMouseDown={(e) => { e.preventDefault(); onSendAsText?.(); }}>Send as text</button>
      </div>
    );
  }
  if (notice.kind === 'help') {
    return (
      <div className="gl-liquid gl-liquid--strong anim-pop-in" style={{ ...box(), flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }} data-testid="slash-help" role="dialog" aria-label="Commands">
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <strong style={{ flex: 1 }}>Commands</strong>
          {closeBtn(onClose)}
        </div>
        {notice.lines.map((l) => (
          <div key={l.usage} style={{ opacity: l.available ? 1 : 0.55 }}>
            <div style={code}>{l.usage}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              {l.description}{l.available ? '' : ' · not here'}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return null;
}
