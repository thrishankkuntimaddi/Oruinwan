// client/src/components/messagesComp/SmartReplyBar.jsx
// Phase-8: AI-generated quick reply chip suggestions
import React, { useState, useEffect, useRef } from 'react';
import api from '@services/api';
import { Sparkles, X } from 'lucide-react';

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

/**
 * SmartReplyBar — shows 3 AI-generated reply suggestions as chips.
 *
 * Props:
 *  messageId       — source message ID (used as cache key)
 *  messageText     — plaintext of the message to reply to
 *  onSelectReply   — callback(text: string) — fills composer with chosen reply
 *  onDismiss       — called when user clicks dismiss
 */
export default function SmartReplyBar({ messageId, messageText, onSelectReply, onDismiss }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(true);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!messageText || !visible) return;
    setLoading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    api.post(
      `/api/v2/messages/ai/suggestions`,
      { messageText, messageId },
      { signal: ctrl.signal }
    )
      .then(res => setSuggestions(res.data?.suggestions || []))
      .catch(() => {}) // silently fail — AI is optional
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [messageId, messageText, visible]);

  if (!visible || !messageText) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
      padding: '4px 0 6px', fontFamily: FONT,
    }}>
      <span style={{
        fontSize: '11px', color: 'var(--accent)', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        <Sparkles size={11} /> Quick reply:
      </span>

      {loading && (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Thinking…
        </span>
      )}

      {!loading && suggestions.map((text, i) => (
        <SuggestionChip
          key={i}
          text={text}
          onClick={() => { onSelectReply?.(text); setVisible(false); }}
        />
      ))}

      <button
        onClick={() => { setVisible(false); onDismiss?.(); }}
        style={{
          background: 'none', border: 'none', outline: 'none',
          color: 'var(--text-muted)', cursor: 'pointer',
          fontSize: '12px', padding: '2px 6px', borderRadius: '2px',
          display: 'flex', alignItems: 'center', transition: '100ms ease',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        <X size={12} />
      </button>
    </div>
  );
}

function SuggestionChip({ text, onClick }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: hovered ? 'rgba(184,149,106,0.12)' : 'var(--bg-active)',
        border: `1px solid ${hovered ? 'var(--border-accent)' : 'var(--border-default)'}`,
        borderRadius: '99px',
        color: hovered ? 'var(--accent)' : 'var(--text-secondary)',
        padding: '4px 12px',
        fontSize: '12px',
        cursor: 'pointer',
        transition: 'background-color 150ms ease, border-color 150ms ease, color 150ms ease',
        whiteSpace: 'nowrap',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {text}
    </button>
  );
}
