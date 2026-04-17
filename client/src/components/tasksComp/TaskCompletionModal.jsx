import React, { useState } from "react";
import { CheckCircle2, X, Send, PartyPopper, Trash2 } from "lucide-react";

export default function TaskCompletionModal({ task, onClose, onConfirm, mode = "completion" }) {
    const [note, setNote] = useState("");
    const isPersonal = task.assigner === "Self";
    const isDeletion = mode === "deletion";

    const handleConfirm = () => {
        onConfirm(note);
    };

    // Theme-aware accent colours
    const accentColor  = isDeletion ? 'var(--state-danger)'  : isPersonal ? 'var(--state-success)' : '#3b82f6';
    const accentBg     = isDeletion ? 'rgba(201,64,64,0.07)' : isPersonal ? 'rgba(58,143,106,0.07)' : 'rgba(59,130,246,0.07)';
    const accentBorder = isDeletion ? 'rgba(201,64,64,0.15)' : isPersonal ? 'rgba(58,143,106,0.15)' : 'rgba(59,130,246,0.15)';

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', width: '100%', maxWidth: '420px', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', background: accentBg }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif', margin: 0 }}>
                        <span style={{ padding: '6px', background: accentBorder, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor }}>
                            {isDeletion ? <Trash2 size={16} /> : isPersonal ? <PartyPopper size={16} /> : <CheckCircle2 size={16} />}
                        </span>
                        {isDeletion ? 'Delete Task?' : isPersonal ? 'Task Completed!' : 'Submit Completion'}
                    </h2>
                    <button
                        onClick={onClose}
                        style={{ padding: '6px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '20px' }}>
                    {isDeletion ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(201,64,64,0.08)', border: '1px solid rgba(201,64,64,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--state-danger)' }}>
                                <Trash2 size={28} />
                            </div>
                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                Are you sure you want to move <strong style={{ color: 'var(--text-primary)' }}>{task.title}</strong> to trash?
                            </p>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                                You can restore it later from the <strong>Deleted</strong> tab.
                            </p>
                        </div>
                    ) : isPersonal ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(58,143,106,0.08)', border: '1px solid rgba(58,143,106,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--state-success)' }}>
                                <CheckCircle2 size={28} />
                            </div>
                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                Great job! You've completed <strong style={{ color: 'var(--text-primary)' }}>{task.title}</strong>.
                            </p>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                                This task will be moved to your <strong>Completed</strong> history.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                You are marking <strong style={{ color: 'var(--text-primary)' }}>{task.title}</strong> as complete. Please provide a brief summary of the work done for <strong style={{ color: 'var(--text-primary)' }}>{task.assigner}</strong>.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                    Completion Note
                                </label>
                                <textarea
                                    placeholder="e.g. Fixed the login bug by updating the auth token logic..."
                                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', resize: 'none', minHeight: '90px', lineHeight: 1.6, fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.5)'}
                                    onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                                    autoFocus
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}>
                    <button
                        onClick={onClose}
                        style={{ padding: '7px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-default)', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms ease' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 20px', background: accentColor, border: 'none', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'opacity 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        {isDeletion ? (
                            <><Trash2 size={14} /> Delete Task</>
                        ) : isPersonal ? (
                            <><CheckCircle2 size={14} /> Complete Task</>
                        ) : (
                            <><Send size={14} /> Submit &amp; Complete</>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
