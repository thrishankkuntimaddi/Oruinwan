import React, { useMemo, useState } from "react";
import { X, Clock, GitCommit } from "lucide-react";

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

function diffWords(oldText = "", newText = "") {
    const oldWords = oldText.split(/\s+/);
    const newWords = newText.split(/\s+/);
    const result = [];

    const matrix = Array.from({ length: oldWords.length + 1 },
        () => Array(newWords.length + 1).fill(0));

    for (let i = 1; i <= oldWords.length; i++) {
        for (let j = 1; j <= newWords.length; j++) {
            if (oldWords[i - 1] === newWords[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1] + 1;
            } else {
                matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
            }
        }
    }

    let i = oldWords.length, j = newWords.length;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
            result.unshift({ type: "same", word: oldWords[i - 1] });
            i--; j--;
        } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
            result.unshift({ type: "add", word: newWords[j - 1] });
            j--;
        } else {
            result.unshift({ type: "remove", word: oldWords[i - 1] });
            i--;
        }
    }
    return result;
}

function fmtDate(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleString(undefined, {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

export default function EditHistoryModal({ message, onClose }) {
    const versions = useMemo(() => {
        const history = message?.editHistory || [];
        const list = [];
        for (let i = history.length - 1; i >= 0; i--) {
            list.push({
                text: history[i].text || "(encrypted)",
                editedAt: history[i].editedAt,
                label: i === history.length - 1 ? "Original" : `Edit ${history.length - i}`
            });
        }
        list.push({
            text: message?.text || "(no text)",
            editedAt: message?.editedAt,
            label: "Current"
        });
        return list;
    }, [message]);

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 50,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
                fontFamily: FONT,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '100%', maxWidth: '520px', margin: '0 16px',
                    maxHeight: '80vh', display: 'flex', flexDirection: 'column',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-accent)',
                    borderRadius: '4px',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                    animation: 'fadeIn 180ms ease',
                }}
                onClick={e => e.stopPropagation()}
            >
                {}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px', borderBottom: '1px solid var(--border-default)', flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <GitCommit size={16} style={{ color: 'var(--accent)' }} />
                        <h2 style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', fontFamily: FONT }}>
                            Edit History
                        </h2>
                        <span style={{
                            fontSize: '10px', fontWeight: 600, padding: '1px 7px', borderRadius: '99px',
                            backgroundColor: 'rgba(184,149,106,0.10)', color: 'var(--accent)',
                            border: '1px solid var(--border-accent)', fontFamily: FONT,
                        }}>
                            {versions.length - 1} edit{versions.length !== 2 ? 's' : ''}
                        </span>
                    </div>
                    <CloseBtn onClick={onClose} />
                </div>

                {}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {versions.map((version, idx) => {
                        const prev = idx > 0 ? versions[idx - 1] : null;
                        const diff = prev ? diffWords(prev.text, version.text) : null;
                        const isCurrent = version.label === "Current";

                        return (
                            <div key={idx} style={{ position: 'relative' }}>
                                {}
                                {idx < versions.length - 1 && (
                                    <div style={{
                                        position: 'absolute', left: '5px', top: '20px', bottom: '-20px', width: '1px',
                                        backgroundColor: 'var(--border-default)',
                                    }} />
                                )}
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    {}
                                    <div style={{
                                        marginTop: '3px', width: '11px', height: '11px', borderRadius: '50%', flexShrink: 0,
                                        backgroundColor: isCurrent ? 'var(--accent)' : 'var(--bg-surface)',
                                        border: `2px solid ${isCurrent ? 'var(--accent)' : 'var(--border-default)'}`,
                                    }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                            <span style={{
                                                fontSize: '11px', fontWeight: 600, fontFamily: FONT,
                                                color: isCurrent ? 'var(--accent)' : 'var(--text-muted)',
                                            }}>
                                                {version.label}
                                            </span>
                                            {version.editedAt && (
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', fontFamily: FONT }}>
                                                    <Clock size={10} /> {fmtDate(version.editedAt)}
                                                </span>
                                            )}
                                        </div>
                                        {}
                                        <div style={{
                                            fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)',
                                            backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-subtle)',
                                            borderRadius: '2px', padding: '8px 12px', wordBreak: 'break-words',
                                            fontFamily: FONT,
                                        }}>
                                            {diff ? (
                                                <span>
                                                    {diff.map((token, ti) => (
                                                        <span
                                                            key={ti}
                                                            style={{
                                                                margin: '0 1px',
                                                                ...(token.type === 'add' ? {
                                                                    backgroundColor: 'rgba(90,186,138,0.15)',
                                                                    color: 'var(--state-success)',
                                                                    padding: '0 2px', borderRadius: '2px',
                                                                } : token.type === 'remove' ? {
                                                                    backgroundColor: 'rgba(255,80,80,0.12)',
                                                                    color: 'var(--state-danger)',
                                                                    textDecoration: 'line-through',
                                                                    padding: '0 2px', borderRadius: '2px',
                                                                } : {}),
                                                            }}
                                                        >
                                                            {token.word}{" "}
                                                        </span>
                                                    ))}
                                                </span>
                                            ) : (
                                                version.text
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function CloseBtn({ onClick }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '5px', border: 'none', outline: 'none', background: 'none',
                cursor: 'pointer', borderRadius: '2px', display: 'flex', transition: '100ms',
                color: hov ? 'var(--state-danger)' : 'var(--text-muted)',
            }}>
            <X size={16} />
        </button>
    );
}
