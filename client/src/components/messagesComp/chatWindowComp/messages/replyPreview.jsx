import React from "react";
import { X, MessageSquare } from "lucide-react";

export default function ReplyPreview({ replyingTo, onCancel }) {
  if (!replyingTo) return null;

  const senderName = replyingTo.senderName || replyingTo.sender?.username || "Someone";
  const previewText =
    replyingTo.text ||
    replyingTo.decryptedContent ||
    replyingTo.payload?.text ||
    "🔒 Encrypted message";

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '6px 16px',
      backgroundColor: 'var(--bg-active)',
      borderTop: '1px solid var(--border-default)',
    }}>
      {}
      <div style={{ width: '2px', height: '28px', backgroundColor: 'var(--accent)', borderRadius: '1px', flexShrink: 0 }} />

      {}
      <MessageSquare size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />

      {}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)', lineHeight: 1.3 }}>
          {senderName}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
          {previewText}
        </div>
      </div>

      {}
      <button
        onClick={onCancel}
        style={{ flexShrink: 0, padding: '4px', background: 'none', border: 'none', outline: 'none', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '100ms ease' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
        title="Cancel reply"
      >
        <X size={13} />
      </button>
    </div>
  );
}
