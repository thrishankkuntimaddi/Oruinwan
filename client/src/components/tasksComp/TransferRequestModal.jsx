import React, { useState } from "react";
import { X, User, Send } from "lucide-react";

export default function TransferRequestModal({ task, members = [], onClose, onConfirm }) {
    const [selectedMember, setSelectedMember] = useState("");
    const [note, setNote] = useState("");

    const handleSubmit = () => {
        if (!selectedMember) {
            return alert("Please select a team member to transfer to");
        }
        onConfirm(selectedMember, note);
    };

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', width: '100%', maxWidth: '420px', overflow: 'hidden', boxShadow: 'var(--card-shadow)', fontFamily: 'Inter, system-ui, sans-serif' }}>

                {}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border-default)' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        <Send size={16} style={{ color: '#3b82f6' }} />
                        Request Task Transfer
                    </h2>
                    <button
                        onClick={onClose}
                        style={{ padding: '6px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {}
                    <div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)' }}>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Task</p>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{task.title}</p>
                    </div>

                    {}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <User size={13} />
                            Transfer to:
                        </label>
                        <select
                            value={selectedMember}
                            onChange={(e) => setSelectedMember(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
                            onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.5)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                        >
                            <option value="">Select team member...</option>
                            {members.map((member) => {
                                const memberId = member._id || member.id;
                                return (
                                    <option key={memberId} value={memberId}>
                                        {member.username || member.email}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            Reason (Optional):
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Why do you need to transfer this task?"
                            style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', resize: 'none', minHeight: '80px', lineHeight: 1.5, fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
                            onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.5)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                        />
                    </div>
                </div>

                {}
                <div style={{ display: 'flex', gap: '10px', padding: '12px 20px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
                    <button
                        onClick={onClose}
                        style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-default)', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms ease' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: '#3b82f6', border: 'none', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'opacity 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        <Send size={13} /> Send Request
                    </button>
                </div>
            </div>
        </div>
    );
}
