import React from "react";
import { CornerDownLeft, X } from "lucide-react";
import "../../../features/messaging/messagingUi.css";

/** What the chosen slash command will do, shown above the composer until it is sent. */
export default function SlashCommandPreview({ command, onClose }) {
  if (!command?.preview) return null;
  const { preview } = command;

  return (
    <div className="mx-pop mx-slash" role="status" aria-live="polite">
      <div className="mx-slash-head">
        <span className="mx-slash-mark" aria-hidden="true">{command.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="mx-slash-title">{preview.title}</span>
          <span className="mx-slash-cmd">{command.command}</span>
        </div>
        <button
          type="button"
          className="gl-icon-btn"
          onMouseDown={(e) => { e.preventDefault(); onClose?.(); }}
          aria-label="Dismiss"
          title="Dismiss (Esc)"
          style={{ width: 26, height: 26 }}
        >
          <X size={14} />
        </button>
      </div>

      <div className="mx-slash-body">
        {preview.actions.map((action, i) => (
          <div key={i} className="mx-slash-row">
            <strong>{action.label}</strong>
            {action.detail && action.detail !== preview.hint && <span>· {action.detail}</span>}
          </div>
        ))}
      </div>

      {preview.hint && (
        <div className="mx-slash-foot">
          <code>{preview.hint}</code>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <span className="mx-kbd"><CornerDownLeft size={10} /></span> to send
          </span>
        </div>
      )}
    </div>
  );
}
