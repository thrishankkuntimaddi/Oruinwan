import React, { useState } from 'react';
import { X, Video, Calendar, Clock, Link, Users } from 'lucide-react';

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

const inputStyle = {
    width: '100%', padding: '8px 10px', fontSize: '13px',
    backgroundColor: 'var(--bg-active)',
    border: '1px solid var(--border-default)',
    borderRadius: '2px', outline: 'none',
    color: 'var(--text-primary)',
    fontFamily: FONT,
    transition: 'border-color 100ms ease',
    boxSizing: 'border-box',
};

export default function ScheduleMeetingModal({ onSchedule, onClose, conversationId, conversationType }) {
    const [title,      setTitle]      = useState('');
    const [startDate,  setStartDate]  = useState('');
    const [startHour,  setStartHour]  = useState('09');
    const [startMin,   setStartMin]   = useState('00');
    const [duration,   setDuration]   = useState(30);
    const [meetingLink,setMeetingLink]= useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error,      setError]      = useState('');

    function buildISO() {
        if (!startDate) return null;
        try { return new Date(`${startDate}T${startHour}:${startMin}:00`).toISOString(); }
        catch { return null; }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (!title.trim()) { setError('A title is required.'); return; }
        const isoTime = buildISO();
        if (!isoTime) { setError('Please set a valid date and time.'); return; }
        if (meetingLink && !/^https?:\/\//i.test(meetingLink)) {
            setError('Meeting link must start with http:// or https://'); return;
        }
        setSubmitting(true);
        try {
            await onSchedule({
                title: title.trim(), startTime: isoTime,
                duration: Number(duration),
                meetingLink: meetingLink.trim() || null,
                participants: [],
            });
            onClose();
        } catch { setError('Failed to schedule meeting. Please try again.'); }
        finally { setSubmitting(false); }
    }

    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const mins  = ['00', '15', '30', '45'];

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 50,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
                fontFamily: FONT,
            }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                width: '100%', maxWidth: '420px', margin: '0 16px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-accent)',
                borderRadius: '4px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                animation: 'fadeIn 180ms ease',
            }}>
                {}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--border-accent)',
                    backgroundColor: 'rgba(184,149,106,0.07)',
                }}>
                    <div style={{
                        width: '30px', height: '30px', borderRadius: '2px', flexShrink: 0,
                        backgroundColor: 'rgba(184,149,106,0.15)',
                        border: '1px solid var(--border-accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--accent)',
                    }}>
                        <Video size={14} />
                    </div>
                    <h2 style={{ margin: 0, flex: 1, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: FONT }}>
                        Schedule Meeting
                    </h2>
                    <CloseBtn onClick={onClose} />
                </div>

                {}
                <form onSubmit={handleSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                    {}
                    <FormField label="Meeting title" required icon={<Users size={11} />}>
                        <input
                            type="text" value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Weekly Sync"
                            maxLength={100}
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                        />
                    </FormField>

                    {}
                    <FormField label="Date" icon={<Calendar size={11} />}>
                        <input
                            type="date" value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            min={new Date().toISOString().slice(0, 10)}
                            style={{ ...inputStyle, colorScheme: 'dark' }}
                            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                        />
                    </FormField>

                    {}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <FormField label="Time" icon={<Clock size={11} />}>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <select value={startHour} onChange={e => setStartHour(e.target.value)}
                                    style={{ ...inputStyle, flex: 1 }}>
                                    {hours.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '14px' }}>:</span>
                                <select value={startMin} onChange={e => setStartMin(e.target.value)}
                                    style={{ ...inputStyle, flex: 1 }}>
                                    {mins.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </FormField>
                        <FormField label="Duration (min)">
                            <select value={duration} onChange={e => setDuration(e.target.value)}
                                style={inputStyle}>
                                {[15, 30, 45, 60, 90, 120].map(d => (
                                    <option key={d} value={d}>{d} min</option>
                                ))}
                            </select>
                        </FormField>
                    </div>

                    {}
                    <FormField label="Meeting link (optional)" icon={<Link size={11} />}>
                        <input
                            type="url" value={meetingLink}
                            onChange={e => setMeetingLink(e.target.value)}
                            placeholder="https://meet.google.com/..."
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                        />
                    </FormField>

                    {}
                    {error && (
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--state-danger)', fontWeight: 500, fontFamily: FONT }}>
                            {error}
                        </p>
                    )}

                    {}
                    <div style={{ display: 'flex', gap: '8px', paddingTop: '2px' }}>
                        <CancelBtn onClick={onClose}>Cancel</CancelBtn>
                        <SubmitBtn disabled={submitting}>
                            {submitting ? 'Scheduling…' : 'Schedule'}
                        </SubmitBtn>
                    </div>
                </form>
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

function FormField({ label, children, required, icon }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Inter, system-ui, sans-serif' }}>
                {icon}
                {label}
                {required && <span style={{ color: 'var(--state-danger)', fontWeight: 700 }}>*</span>}
            </label>
            {children}
        </div>
    );
}

function CancelBtn({ onClick, children }) {
    const [hov, setHov] = useState(false);
    return (
        <button type="button" onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                flex: 1, padding: '9px 0', fontSize: '13px', fontWeight: 500,
                color: hov ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: hov ? 'var(--bg-hover)' : 'var(--bg-active)',
                border: '1px solid var(--border-default)', borderRadius: '2px',
                cursor: 'pointer', outline: 'none', transition: '100ms', fontFamily: 'Inter, system-ui, sans-serif',
            }}>
            {children}
        </button>
    );
}

function SubmitBtn({ disabled, children }) {
    const [hov, setHov] = useState(false);
    return (
        <button type="submit" disabled={disabled}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                flex: 1, padding: '9px 0', fontSize: '13px', fontWeight: 600,
                backgroundColor: disabled ? 'var(--bg-active)' : (hov ? 'var(--accent-hover)' : 'var(--accent)'),
                color: disabled ? 'var(--text-muted)' : '#0c0c0c',
                border: `1px solid ${disabled ? 'var(--border-default)' : 'var(--accent)'}`,
                borderRadius: '2px', cursor: disabled ? 'not-allowed' : 'pointer',
                outline: 'none', transition: '100ms', fontFamily: 'Inter, system-ui, sans-serif',
                opacity: disabled ? 0.6 : 1,
            }}>
            {children}
        </button>
    );
}
