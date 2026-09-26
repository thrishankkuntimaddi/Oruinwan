import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

const inputStyle = {
    width: '100%', padding: '8px 10px', fontSize: '13px',
    backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)',
    borderRadius: '2px', outline: 'none', color: 'var(--text-primary)',
    fontFamily: FONT, boxSizing: 'border-box', transition: 'border-color 100ms ease',
};

export default function PollCreationModal({ onClose, onCreate }) {
    const [question, setQuestion] = useState('');
    const [options,  setOptions]  = useState(['', '']);
    const [type,     setType]     = useState('single');
    const [errors,   setErrors]   = useState({});

    const handleAddOption = () => { if (options.length < 10) setOptions([...options, '']); };
    const handleRemoveOption = (index) => { if (options.length > 2) setOptions(options.filter((_, i) => i !== index)); };
    const handleOptionChange = (index, value) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const validate = () => {
        const newErrors = {};
        if (!question.trim()) newErrors.question = 'Question is required';
        const validOptions = options.filter(opt => opt.trim());
        if (validOptions.length < 2) newErrors.options = 'At least 2 options are required';
        const uniqueOptions = new Set(validOptions.map(opt => opt.trim().toLowerCase()));
        if (uniqueOptions.size !== validOptions.length) newErrors.options = 'Options must be unique';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        const validOptions = options.filter(opt => opt.trim());
        await onCreate({
            question: question.trim(),
            options: validOptions.map(opt => opt.trim()),
            allowMultiple: type === 'multiple',
        });
    };

    return (
        <div style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50, fontFamily: FONT,
        }}>
            <div style={{
                width: '100%', maxWidth: '440px', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-accent)',
                borderRadius: '4px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                animation: 'fadeIn 180ms ease',
            }}>
                {}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
                    <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: FONT }}>Create Poll</h2>
                    <CloseBtn onClick={onClose} />
                </div>

                {}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {}
                    <div>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', fontFamily: FONT }}>
                            Poll Question <span style={{ color: 'var(--state-danger)' }}>*</span>
                        </label>
                        <input
                            type="text" value={question} autoFocus
                            onChange={e => setQuestion(e.target.value)}
                            placeholder="Ask a question…"
                            style={{ ...inputStyle, borderColor: errors.question ? 'var(--state-danger)' : 'var(--border-default)' }}
                            onFocus={e => e.target.style.borderColor = errors.question ? 'var(--state-danger)' : 'var(--border-accent)'}
                            onBlur={e => e.target.style.borderColor = errors.question ? 'var(--state-danger)' : 'var(--border-default)'}
                        />
                        {errors.question && (
                            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--state-danger)', fontFamily: FONT }}>{errors.question}</p>
                        )}
                    </div>

                    {}
                    <div>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontFamily: FONT }}>
                            Poll Type
                        </label>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            {[{ val: 'single', label: 'Single Choice' }, { val: 'multiple', label: 'Multiple Choice' }].map(({ val, label }) => (
                                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: FONT }}>
                                    <input
                                        type="radio" value={val}
                                        checked={type === val}
                                        onChange={e => setType(e.target.value)}
                                        style={{ accentColor: 'var(--accent)' }}
                                    />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </div>

                    {}
                    <div>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontFamily: FONT }}>
                            Options <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(2–10)</span>
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {options.map((option, index) => (
                                <div key={index} style={{ display: 'flex', gap: '6px' }}>
                                    <input
                                        type="text" value={option}
                                        onChange={e => handleOptionChange(index, e.target.value)}
                                        placeholder={`Option ${index + 1}`}
                                        style={{ ...inputStyle, flex: 1, borderColor: errors.options ? 'var(--state-danger)' : 'var(--border-default)' }}
                                        onFocus={e => e.target.style.borderColor = errors.options ? 'var(--state-danger)' : 'var(--border-accent)'}
                                        onBlur={e => e.target.style.borderColor = errors.options ? 'var(--state-danger)' : 'var(--border-default)'}
                                    />
                                    {options.length > 2 && (
                                        <TrashBtn onClick={() => handleRemoveOption(index)} />
                                    )}
                                </div>
                            ))}
                        </div>

                        {options.length < 10 && (
                            <AddOptionBtn onClick={handleAddOption} />
                        )}

                        {errors.options && (
                            <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--state-danger)', fontFamily: FONT }}>{errors.options}</p>
                        )}
                    </div>
                </div>

                {}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', padding: '12px 16px', borderTop: '1px solid var(--border-default)', flexShrink: 0 }}>
                    <CancelBtn onClick={onClose}>Cancel</CancelBtn>
                    <CreateBtn onClick={handleSubmit}>Create Poll</CreateBtn>
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
            style={{ padding: '5px', border: 'none', outline: 'none', background: 'none', cursor: 'pointer', borderRadius: '2px', display: 'flex', transition: '100ms', color: hov ? 'var(--state-danger)' : 'var(--text-muted)' }}>
            <X size={18} />
        </button>
    );
}

function TrashBtn({ onClick }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '7px', border: 'none', outline: 'none', borderRadius: '2px', cursor: 'pointer',
                color: hov ? 'var(--state-danger)' : 'var(--text-muted)',
                backgroundColor: hov ? 'rgba(255,80,80,0.08)' : 'transparent', transition: '100ms ease', display: 'flex',
            }}>
            <Trash2 size={16} />
        </button>
    );
}

function AddOptionBtn({ onClick }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px',
                fontSize: '12px', fontWeight: 500,
                color: hov ? 'var(--accent)' : 'var(--text-muted)',
                background: 'none', border: 'none', outline: 'none', cursor: 'pointer',
                transition: '100ms ease', fontFamily: 'Inter, system-ui, sans-serif', padding: '2px 0',
            }}>
            <Plus size={14} /> Add Option
        </button>
    );
}

function CancelBtn({ onClick, children }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '8px 16px', fontSize: '13px', fontWeight: 500,
                color: hov ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: hov ? 'var(--bg-hover)' : 'transparent',
                border: '1px solid var(--border-default)', borderRadius: '2px',
                cursor: 'pointer', outline: 'none', transition: '100ms', fontFamily: 'Inter, system-ui, sans-serif',
            }}>{children}</button>
    );
}

function CreateBtn({ onClick, children }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                backgroundColor: hov ? 'var(--accent-hover)' : 'var(--accent)',
                color: '#0c0c0c', border: '1px solid var(--accent)',
                borderRadius: '2px', cursor: 'pointer', outline: 'none',
                transition: '100ms', fontFamily: 'Inter, system-ui, sans-serif',
            }}>{children}</button>
    );
}
