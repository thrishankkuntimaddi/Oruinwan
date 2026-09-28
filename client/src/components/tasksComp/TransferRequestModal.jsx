import React, { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { TaskDialog } from "./taskUi";

/** Assignee asks the task's creator to hand the task to another member. */
export default function TransferRequestModal({ task, members = [], currentUserId, onClose, onConfirm }) {
    const [selectedMember, setSelectedMember] = useState("");
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);

    const candidates = members.filter((m) => {
        const id = String(m._id || m.id);
        return id !== String(currentUserId) && !(task.assigneeIds || []).includes(id);
    });

    const submit = async () => {
        if (!selectedMember || busy) return;
        setBusy(true);
        try { await onConfirm(selectedMember, note.trim()); } finally { setBusy(false); }
    };

    return (
        <TaskDialog
            title="Request transfer"
            subtitle={task.title}
            icon={<Send size={15} />}
            onClose={busy ? undefined : onClose}
            footer={(
                <>
                    <button type="button" className="tk-btn" onClick={onClose} disabled={busy}>Cancel</button>
                    <button type="button" className="tk-btn tk-btn-primary" onClick={submit} disabled={!selectedMember || busy}>
                        {busy ? <Loader2 size={13} className="tk-spin" /> : <Send size={13} />} {busy ? 'Sending…' : 'Send request'}
                    </button>
                </>
            )}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                    The creator{task.creator?.username ? ` (${task.creator.username})` : ''} approves or rejects the request. You stay assigned until then.
                </p>
                <div>
                    <label className="tk-label" htmlFor="tk-transfer-to">Transfer to</label>
                    <select id="tk-transfer-to" className="tk-field" value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)} style={{ fontSize: '13px' }}>
                        <option value="">Select a member…</option>
                        {candidates.map((m) => {
                            const id = m._id || m.id;
                            return <option key={id} value={id}>{m.username || m.email}</option>;
                        })}
                    </select>
                </div>
                <div>
                    <label className="tk-label" htmlFor="tk-transfer-note">Reason (optional)</label>
                    <textarea id="tk-transfer-note" className="tk-field" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                        placeholder="Why should someone else take this task?" style={{ resize: 'vertical', fontSize: '13px', lineHeight: 1.5 }} />
                </div>
            </div>
        </TaskDialog>
    );
}
