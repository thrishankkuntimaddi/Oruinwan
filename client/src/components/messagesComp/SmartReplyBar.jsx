// client/src/components/messagesComp/SmartReplyBar.jsx
// Phase-8: AI-generated quick reply chip suggestions
import React, { useState, useEffect, useRef } from 'react';
import api from '@services/api';

const API = import.meta.env.VITE_API_URL || '';

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
      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      padding: '4px 0 6px', fontFamily: 'Inter, sans-serif' }}>
      <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0 }}>💡 Quick reply:</span>

      {loading && (
        <span style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>Thinking…</span>
      )}

      {!loading && suggestions.map((text, i) => (
        <button
          key={i}
          onClick={() => { onSelectReply?.(text); setVisible(false); }}
          style={{
            background: '#2d3035',
            border: '1px solid #3a3d42',
            borderRadius: 16,
            color: '#d1d5db',
            padding: '4px 12px',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
            whiteSpace: 'nowrap' }}
          onMouseEnter={e => { e.target.style.background = '#5865f220'; e.target.style.borderColor = '#5865f2'; }}
          onMouseLeave={e => { e.target.style.background = '#2d3035'; e.target.style.borderColor = '#3a3d42'; }}
        >
          {text}
        </button>
      ))}

      <button
        onClick={() => { setVisible(false); onDismiss?.(); }}
        style={{
          background: 'none', border: 'none', color: '#6b7280',
          cursor: 'pointer', fontSize: 12, padding: '2px 6px' }}
      >
        ✕
      </button>
    </div>
  );
}
