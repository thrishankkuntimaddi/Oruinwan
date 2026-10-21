import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { X, Video, Calendar, Clock, Link, Users, UserPlus, Check } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../../../contexts/AuthContext';
import FindTimeSlots from '../../../../components/meetingsComp/FindTimeSlots';

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

const pad = (n) => String(n).padStart(2, '0');
/** YYYY-MM-DD in the user's local time zone (toISOString would give the UTC date). */
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Default slot: the next full hour (tomorrow when that crosses midnight). */
function nextFullHour() {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return { date: localDate(d), hour: pad(d.getHours()) };
}

/**
 * Schedule a meeting. `conversationType` ('channel' | 'dm') places it in that conversation:
 * its people are invited unless you pick some. Elsewhere, nobody picked = the whole workspace.
 */
export default function ScheduleMeetingModal({ onSchedule, onClose, conversationType = null }) {
    const { workspaceId } = useParams();
    const { user } = useAuth() || {};
    const myId = String(user?.id || user?._id || user?.sub || '');
    const [members, setMembers] = useState([]);
    const [invited, setInvited] = useState([]);
    const [memberQuery, setMemberQuery] = useState('');
    useEffect(() => {
        if (!workspaceId || conversationType === 'dm') return undefined;
        let cancelled = false;
        api.get(`/api/workspaces/${workspaceId}/members`)
            .then(({ data }) => { if (!cancelled) setMembers((data?.members || []).filter(m => String(m._id) !== myId && (m.membershipStatus || 'active') === 'active')); })
            .catch(() => { /* the picker just stays empty */ });
        return () => { cancelled = true; };
    }, [workspaceId, conversationType, myId]);
    const shownMembers = useMemo(() => {
        const q = memberQuery.trim().toLowerCase();
        const list = q ? members.filter(m => `${m.username} ${m.profile?.name || ''} ${m.email || ''}`.toLowerCase().includes(q)) : members;
        return list.slice(0, 30);
    }, [members, memberQuery]);
    const toggleInvite = (id) => setInvited(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    const [defaults] = useState(nextFullHour);
    const [title,      setTitle]      = useState('');
    const [startDate,  setStartDate]  = useState(defaults.date);
    const [startHour,  setStartHour]  = useState(defaults.hour);
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
        if (new Date(isoTime).getTime() < Date.now() - 60000) { setError('Pick a time in the future.'); return; }
        if (meetingLink && !/^https?:\/\//i.test(meetingLink)) {
            setError('Meeting link must start with http:// or https://'); return;
        }
        setSubmitting(true);
        try {
            await onSchedule({
                title: title.trim(), startTime: isoTime,
                duration: Number(duration),
                meetingLink: meetingLink.trim() || null,
                participants: invited,
            });
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Failed to schedule meeting. Please try again.');
        }
        finally { setSubmitting(false); }
    }

    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const mins  = ['00', '15', '30', '45'];
    if (!mins.includes(startMin)) mins.push(startMin);
    mins.sort();
    const durations = [15, 30, 45, 60, 90, 120];
    if (!durations.includes(Number(duration))) durations.push(Number(duration));
    durations.sort((a, b) => a - b);

    // A slot from "Find a time" fills in the date, time and length.
    const pickSlot = ({ start, end }) => {
        setStartDate(localDate(start));
        setStartHour(pad(start.getHours()));
        setStartMin(pad(start.getMinutes()));
        const length = Math.round((end - start) / 60000);
        if (length > 0 && length <= 480) setDuration(length);
        setError('');
    };

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 50,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(3px)',
                fontFamily: FONT,
            }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                width: '100%', maxWidth: '420px', margin: '0 16px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-accent)',
                borderRadius: '4px',
                boxShadow: 'var(--lg-shadow-sm)',
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
                            min={localDate(new Date())}
                            // Native date picker follows the app theme (html.light), not the OS.
                            style={{ ...inputStyle, colorScheme: document.documentElement.classList.contains('light') ? 'light' : 'dark' }}
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
                                {durations.map(d => (
                                    <option key={d} value={d}>{d} min</option>
                                ))}
                            </select>
                        </FormField>
                    </div>

                    <FindTimeSlots participantIds={invited} durationMinutes={Number(duration)} onPick={pickSlot} />

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

                    {conversationType !== 'dm' && members.length > 0 && (
                        <FormField label="Invite" icon={<UserPlus size={11} />}>
                            <p style={{ margin: '0 0 4px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: FONT }}>
                                {invited.length
                                    ? `${invited.length} ${invited.length === 1 ? 'person' : 'people'} will get an invite.`
                                    : conversationType === 'channel' ? 'Nobody picked: everyone in this channel gets an invite.' : 'Nobody picked: everyone in the workspace gets an invite.'}
                            </p>
                            {members.length > 8 && (
                                <input type="search" value={memberQuery} onChange={e => setMemberQuery(e.target.value)} placeholder="Find people…" style={{ ...inputStyle, marginBottom: '6px' }} />
                            )}
                            <div data-testid="meeting-invitees" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '96px', overflowY: 'auto' }}>
                                {shownMembers.map(m => {
                                    const on = invited.includes(String(m._id));
                                    return (
                                        <button key={m._id} type="button" onClick={() => toggleInvite(String(m._id))} aria-pressed={on}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 9px', fontSize: '12px', borderRadius: '2px', cursor: 'pointer', fontFamily: FONT,
                                                background: on ? 'var(--accent)' : 'var(--bg-active)', color: on ? 'var(--bg-base)' : 'var(--text-secondary)',
                                                border: `1px solid ${on ? 'var(--accent)' : 'var(--border-default)'}`,
                                            }}>
                                            {on && <Check size={11} />}{m.profile?.name || m.username}
                                        </button>
                                    );
                                })}
                            </div>
                        </FormField>
                    )}

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
                color: disabled ? 'var(--text-muted)' : 'var(--bg-base)',
                border: `1px solid ${disabled ? 'var(--border-default)' : 'var(--accent)'}`,
                borderRadius: '2px', cursor: disabled ? 'not-allowed' : 'pointer',
                outline: 'none', transition: '100ms', fontFamily: 'Inter, system-ui, sans-serif',
                opacity: disabled ? 0.6 : 1,
            }}>
            {children}
        </button>
    );
}
