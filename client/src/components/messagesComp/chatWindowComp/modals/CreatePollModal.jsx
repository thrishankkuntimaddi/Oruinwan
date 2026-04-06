import React, { useState } from 'react';
import { X, Plus, Trash2, BarChart2 } from 'lucide-react';

const inputStyle = {
    width: '100%', padding: '8px 12px', boxSizing: 'border-box',
    backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)',
    borderRadius: '2px', fontSize: '13px', color: 'var(--text-primary)',
    outline: 'none', fontFamily: 'var(--font)', transition: 'border-color 150ms ease',
};

const labelStyle = {
    display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px',
};

function Checkbox({ checked, onChange, label, sub }) {
    return (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
            <div
                onClick={() => onChange(!checked)}
                style={{
                    width: '16px', height: '16px', borderRadius: '2px', flexShrink: 0, marginTop: '1px',
                    backgroundColor: checked ? 'var(--accent)' : 'var(--bg-input)',
                    border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-default)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: '150ms ease',
                }}
            >
                {checked && <span style={{ color: '#0c0c0c', fontSize: '10px', fontWeight: 900, lineHeight: 1 }}>✓</span>}
            </div>
            <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{sub}</div>
            </div>
        </label>
    );
}

export default function CreatePollModal({ isOpen, onClose, onCreatePoll, channelName }) {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);
    const [allowMultiple, setAllowMultiple] = useState(false);
    const [anonymous, setAnonymous] = useState(false);
    const [endDate, setEndDate] = useState('');

    const addOption = () => { if (options.length < 10) setOptions([...options, '']); };
    const removeOption = (i) => { if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i)); };
    const updateOption = (i, v) => { const n = [...options]; n[i] = v; setOptions(n); };

    const handleSubmit = (e) => {
        e.preventDefault();
        const validOptions = options.filter(o => o.trim() !== '');
        if (!question.trim() || validOptions.length < 2) return;
        onCreatePoll({
            question: question.trim(),
            options: validOptions.map(o => ({ text: o.trim(), votes: [], count: 0 })),
            allowMultiple, anonymous,
            endDate: endDate || null,
            createdAt: new Date().toISOString(),
            votes: {}, totalVotes: 0, status: 'active',
        });
        handleClose();
    };

    const handleClose = () => {
        setQuestion(''); setOptions(['', '']);
        setAllowMultiple(false); setAnonymous(false); setEndDate('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px', backdropFilter: 'blur(4px)', fontFamily: 'var(--font)' }}
            onClick={handleClose}
        >
            <div
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-accent)', borderRadius: '2px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '2px', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BarChart2 size={16} style={{ color: 'var(--accent)' }} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Create Poll</h2>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>#{channelName}</p>
                        </div>
                    </div>
                    <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px', borderRadius: '2px', transition: '150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} style={{ overflowY: 'auto', flex: 1 }}>
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        {/* Question */}
                        <div>
                            <label style={labelStyle}>Question *</label>
                            <input
                                type="text" value={question}
                                onChange={e => setQuestion(e.target.value)}
                                placeholder="What do you want to ask?"
                                style={inputStyle} required
                                onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                            />
                        </div>

                        {/* Options */}
                        <div>
                            <label style={labelStyle}>Options * (minimum 2)</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {options.map((option, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <input
                                            type="text" value={option}
                                            onChange={e => updateOption(i, e.target.value)}
                                            placeholder={`Option ${i + 1}`}
                                            style={{ ...inputStyle, flex: 1 }} required
                                            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                                        />
                                        {options.length > 2 && (
                                            <button type="button" onClick={() => removeOption(i)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px', borderRadius: '2px', transition: '150ms ease' }}
                                                onMouseEnter={e => e.currentTarget.style.color = 'var(--state-danger)'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {options.length < 10 && (
                                <button type="button" onClick={addOption}
                                    style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '12px', fontWeight: 500, padding: '4px 0', fontFamily: 'var(--font)', transition: '150ms ease' }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                >
                                    <Plus size={14} /> Add Option
                                </button>
                            )}
                        </div>

                        {/* Settings */}
                        <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <Checkbox checked={allowMultiple} onChange={setAllowMultiple} label="Allow multiple selections" sub="Users can vote for more than one option" />
                            <Checkbox checked={anonymous} onChange={setAnonymous} label="Anonymous voting" sub="Don't show who voted for what" />
                        </div>

                        {/* End Date */}
                        <div>
                            <label style={labelStyle}>End Date (Optional)</label>
                            <input
                                type="datetime-local" value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                min={new Date().toISOString().slice(0, 16)}
                                style={{ ...inputStyle, colorScheme: 'dark' }}
                                onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-active)', flexShrink: 0 }}>
                        <button type="button" onClick={handleClose}
                            style={{ padding: '7px 16px', fontSize: '13px', color: 'var(--text-secondary)', backgroundColor: 'transparent', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >Cancel</button>
                        <button type="submit"
                            disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
                            style={{ padding: '7px 20px', fontSize: '13px', fontWeight: 600, color: '#0c0c0c', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease', opacity: (!question.trim() || options.filter(o => o.trim()).length < 2) ? 0.5 : 1 }}
                            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.opacity = '0.85'; }}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >Create Poll</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
