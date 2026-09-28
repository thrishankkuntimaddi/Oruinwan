import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Calendar, Users, FileText, CheckSquare, Sparkles,
    Video, Square, Plus, Trash2, Edit3, Save,
    ArrowLeft, Loader2, PenTool, StickyNote, ExternalLink,
} from 'lucide-react';
import Whiteboard from '../../components/meetingsComp/Whiteboard';
import BrainstormBoard from '../../components/meetingsComp/BrainstormBoard';
import { useMeeting, useSharedNotes } from '../../hooks/useMeeting';
import { useToast } from '../../contexts/ToastContext';
import { meetingConversationPath } from '../../features/huddles/HuddleContext';

const FONT = 'Inter, system-ui, sans-serif';

// Shared inline styles, all on the app's theme tokens (light and dark).
const ui = {
    card: { background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px' },
    label: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' },
    input: {
        width: '100%', padding: '8px 10px', fontSize: '13px', background: 'var(--bg-input)', border: '1px solid var(--border-default)',
        borderRadius: '2px', color: 'var(--text-primary)', outline: 'none', fontFamily: FONT, boxSizing: 'border-box',
    },
    primary: (disabled) => ({
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '13px', fontWeight: 600,
        background: 'var(--accent)', color: '#0c0c0c', border: '1px solid var(--accent)', borderRadius: '2px',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, fontFamily: FONT, whiteSpace: 'nowrap',
    }),
    secondary: {
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '13px', fontWeight: 600,
        background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-accent)', borderRadius: '2px',
        cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap',
    },
    danger: {
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '13px', fontWeight: 600,
        background: 'transparent', color: 'var(--state-danger)', border: '1px solid var(--state-danger)', borderRadius: '2px',
        cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap',
    },
    iconBtn: { display: 'flex', padding: '4px', background: 'none', border: 'none', borderRadius: '2px', color: 'var(--text-secondary)', cursor: 'pointer' },
    muted: { fontSize: '13px', color: 'var(--text-secondary)' },
};

const STATUS_TONE = {
    scheduled: 'var(--accent)',
    live: 'var(--state-success)',
    completed: 'var(--text-secondary)',
    cancelled: 'var(--state-danger)',
};

const StatusBadge = ({ status = 'scheduled' }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '2px 8px', borderRadius: '2px', border: `1px solid ${STATUS_TONE[status] || STATUS_TONE.scheduled}`, color: STATUS_TONE[status] || STATUS_TONE.scheduled, fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
        {status === 'live' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--state-success)' }} />}
        {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
);

const TabBtn = ({ label, icon: Icon, active, onClick }) => (
    <button
        role="tab"
        aria-selected={active}
        onClick={onClick}
        style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 12px', fontSize: '13px', fontWeight: active ? 600 : 500,
            background: 'transparent', border: 'none', borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
            color: active ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap',
        }}
    >
        <Icon size={14} />
        {label}
    </button>
);

/** A short note on how a tab's content is shared, so nothing looks more live than it is. */
const SyncNote = ({ children, tone = 'muted' }) => (
    <p style={{ fontSize: '12px', color: tone === 'error' ? 'var(--state-danger)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
        {children}
    </p>
);

const OverviewTab = ({ meeting, onJoin, onEnd, joining, inConversation }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={{ ...ui.card, padding: '14px 16px' }}>
                <p style={{ ...ui.label, marginBottom: '6px' }}>Start time</p>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {meeting.startTime ? new Date(meeting.startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                </p>
            </div>
            <div style={{ ...ui.card, padding: '14px 16px' }}>
                <p style={{ ...ui.label, marginBottom: '6px' }}>Duration</p>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{meeting.duration || 30} min</p>
            </div>
        </div>

        <div>
            <h4 style={{ ...ui.label, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <Users size={13} /> Participants ({meeting.participants?.length || 0})
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {meeting.participants?.length > 0 ? (
                    meeting.participants.map(p => (
                        <span key={p._id} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 10px 4px 4px', ...ui.card, fontSize: '13px', color: 'var(--text-primary)' }}>
                            <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
                                {(p.firstName?.[0] || p.username?.[0] || '?').toUpperCase()}
                            </span>
                            {p.firstName ? `${p.firstName} ${p.lastName || ''}`.trim() : p.username}
                        </span>
                    ))
                ) : (
                    <p style={ui.muted}>Nobody has joined yet.</p>
                )}
            </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {(meeting.status === 'scheduled' || meeting.status === 'live') && (
                <button onClick={onJoin} disabled={joining} style={ui.primary(joining)} data-testid="meeting-join">
                    {joining ? <Loader2 size={15} className="animate-spin" /> : <Video size={15} />}
                    {meeting.status === 'live' ? 'Join huddle' : 'Start huddle'}
                </button>
            )}
            {meeting.meetingLink && (
                <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer" style={{ ...ui.secondary, textDecoration: 'none' }}>
                    <ExternalLink size={14} /> Open meeting link
                </a>
            )}
            {meeting.status === 'live' && (
                <button onClick={onEnd} style={ui.danger}>
                    <Square size={14} /> End meeting
                </button>
            )}
        </div>
        {(meeting.status === 'scheduled' || meeting.status === 'live') && (
            <SyncNote>
                {inConversation
                    ? 'This meeting was scheduled in a conversation; the call happens in that conversation.'
                    : 'The call is a huddle on the Huddles page. Everyone who joins this meeting lands in the same huddle.'}
            </SyncNote>
        )}
    </div>
);

const AgendaTab = ({ meeting, onSave }) => {
    const { showToast } = useToast();
    const [items, setItems] = useState(meeting.agenda || []);
    const [dirty, setDirty] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const [editingIdx, setEditingIdx] = useState(null);

    // Someone else saved the agenda: take it unless I have unsaved changes.
    useEffect(() => {
        if (!dirty) setItems(meeting.agenda || []);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meeting.agenda]);

    const change = (fn) => { setItems(fn); setDirty(true); };

    const addItem = () => {
        if (!newTitle.trim()) return;
        change(prev => [...prev, { title: newTitle.trim(), notes: '', order: prev.length }]);
        setNewTitle('');
    };

    const removeItem = (idx) => change(prev => prev.filter((_, i) => i !== idx));

    const saveAgenda = async () => {
        setSaving(true);
        try {
            await onSave(items.map((it, i) => ({ ...it, order: i })));
            setDirty(false);
            showToast('Agenda saved', 'success');
        } catch (err) {
            showToast(err?.response?.data?.message || 'Could not save the agenda', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '760px' }}>
            <SyncNote>Saved agendas appear for everyone who has this meeting open.</SyncNote>
            <div style={{ display: 'flex', gap: '8px' }}>
                <input
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addItem()}
                    placeholder="Add agenda item…"
                    style={{ ...ui.input, flex: 1 }}
                />
                <button onClick={addItem} style={ui.secondary}><Plus size={14} /> Add</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {items.length === 0 && <p style={{ ...ui.muted, textAlign: 'center', padding: '24px 0' }}>No agenda items yet. Add one above.</p>}
                {items.map((item, idx) => (
                    <div key={idx} style={{ ...ui.card, display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px' }}>
                        <span style={{ width: '20px', height: '20px', borderRadius: '2px', background: 'var(--bg-active)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>{idx + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            {editingIdx === idx ? (
                                <input
                                    autoFocus
                                    value={item.title}
                                    onChange={e => change(prev => prev.map((it, i) => i === idx ? { ...it, title: e.target.value } : it))}
                                    onBlur={() => setEditingIdx(null)}
                                    onKeyDown={e => e.key === 'Enter' && setEditingIdx(null)}
                                    style={{ ...ui.input, padding: '4px 6px' }}
                                />
                            ) : (
                                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{item.title}</p>
                            )}
                            {item.notes && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{item.notes}</p>}
                        </div>
                        <button onClick={() => setEditingIdx(idx)} title="Edit item" aria-label="Edit item" style={ui.iconBtn}><Edit3 size={13} /></button>
                        <button onClick={() => removeItem(idx)} title="Remove item" aria-label="Remove item" style={ui.iconBtn}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--state-danger)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}><Trash2 size={13} /></button>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={saveAgenda} disabled={saving || !dirty} style={ui.primary(saving || !dirty)}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save agenda
                </button>
                {dirty && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Unsaved changes</span>}
            </div>
        </div>
    );
};

const NOTES_STATUS = {
    saving: 'Saving…',
    saved: 'Saved',
};

const NotesTab = ({ meetingId, room, fallbackNotes }) => {
    const { notes, handleNotesChange, status } = useSharedNotes(meetingId, {
        initialNotes: room.joined ? room.notes : null,
        joined: room.joined,
    });

    let note;
    if (room.error) note = <SyncNote tone="error">{room.error}</SyncNote>;
    else if (!room.joined) note = <SyncNote><Loader2 size={12} className="animate-spin" /> Connecting to the meeting…</SyncNote>;
    else if (status.state === 'error') note = <SyncNote tone="error">Not saved: {status.message}</SyncNote>;
    else note = (
        <SyncNote>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--state-success)' }} />
            Everyone with this meeting open sees changes as you type.
            {NOTES_STATUS[status.state] && <span style={{ marginLeft: 'auto' }}>{NOTES_STATUS[status.state]}</span>}
        </SyncNote>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {note}
            <textarea
                data-testid="meeting-shared-notes"
                value={room.joined ? notes : (fallbackNotes || notes)}
                onChange={e => handleNotesChange(e.target.value)}
                readOnly={!room.joined}
                placeholder={room.joined ? 'Start typing shared notes…' : ''}
                style={{ ...ui.input, flex: 1, minHeight: '320px', padding: '14px', lineHeight: 1.6, resize: 'none', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', opacity: room.joined ? 1 : 0.7 }}
            />
        </div>
    );
};

const TranscriptTab = ({ meeting, onSaveTranscript, onGenerateSummary }) => {
    const [transcript, setTranscript] = useState(meeting.transcript || '');
    const [summary, setSummary] = useState(meeting.summary || '');
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const { showToast } = useToast();

    const saveTranscript = async () => {
        setSaving(true);
        try {
            await onSaveTranscript(transcript);
            showToast('Transcript saved', 'success');
        } catch (err) {
            showToast(err?.response?.data?.message || 'Could not save the transcript', 'error');
        } finally {
            setSaving(false);
        }
    };

    const generateSummary = async () => {
        setGenerating(true);
        try {
            const result = await onGenerateSummary();
            setSummary(result);
            showToast('Summary generated', 'success');
        } catch (err) {
            showToast(err?.response?.data?.message || 'Could not generate a summary', 'error');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '860px' }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h4 style={ui.label}>Transcript</h4>
                    <button onClick={saveTranscript} disabled={saving} style={{ ...ui.secondary, padding: '5px 10px', fontSize: '12px' }}>
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                    </button>
                </div>
                <textarea
                    value={transcript}
                    onChange={e => setTranscript(e.target.value)}
                    placeholder="Paste or type the meeting transcript here…"
                    style={{ ...ui.input, height: '160px', resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                />
            </div>

            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <h4 style={{ ...ui.label, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={13} style={{ color: 'var(--accent)' }} /> AI summary
                    </h4>
                    <button onClick={generateSummary} disabled={generating} style={ui.primary(generating)}>
                        {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {generating ? 'Generating…' : 'Generate summary'}
                    </button>
                </div>
                {summary ? (
                    <div style={{ ...ui.card, padding: '14px 16px', borderLeft: '3px solid var(--accent)' }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{summary}</p>
                    </div>
                ) : (
                    <p style={{ ...ui.muted, textAlign: 'center', padding: '24px 0' }}>No summary yet. Add a transcript and click "Generate summary".</p>
                )}
            </div>
        </div>
    );
};

const ACTION_TONE = {
    pending: 'var(--text-secondary)',
    in_progress: 'var(--accent)',
    done: 'var(--state-success)',
};

const ActionItemsTab = ({ meeting, onAdd, onUpdate }) => {
    const { showToast } = useToast();
    const [newText, setNewText] = useState('');
    const [adding, setAdding] = useState(false);

    const handleAdd = async () => {
        if (!newText.trim()) return;
        setAdding(true);
        try {
            await onAdd({ text: newText.trim() });
            setNewText('');
        } catch (err) {
            showToast(err?.response?.data?.message || 'Could not add the action item', 'error');
        } finally {
            setAdding(false);
        }
    };

    const cycleStatus = async (item) => {
        const next = { pending: 'in_progress', in_progress: 'done', done: 'pending' };
        try {
            await onUpdate(item._id, { status: next[item.status] || 'pending' });
        } catch (err) {
            showToast(err?.response?.data?.message || 'Could not update the action item', 'error');
        }
    };

    const items = meeting.actionItems || [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '760px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
                <input
                    value={newText}
                    onChange={e => setNewText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder="Add action item…"
                    style={{ ...ui.input, flex: 1 }}
                />
                <button onClick={handleAdd} disabled={adding} style={ui.secondary}>
                    {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {items.length === 0 && <p style={{ ...ui.muted, textAlign: 'center', padding: '24px 0' }}>No action items yet.</p>}
                {items.map(item => (
                    <div key={item._id} style={{ ...ui.card, display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px' }}>
                        <button
                            onClick={() => cycleStatus(item)}
                            title="Change status"
                            style={{ padding: '2px 8px', borderRadius: '2px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', background: 'transparent', border: `1px solid ${ACTION_TONE[item.status] || ACTION_TONE.pending}`, color: ACTION_TONE[item.status] || ACTION_TONE.pending, cursor: 'pointer', fontFamily: FONT }}
                        >
                            {(item.status || 'pending').replace('_', ' ')}
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '13px', fontWeight: 500, color: item.status === 'done' ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: item.status === 'done' ? 'line-through' : 'none' }}>
                                {item.text}
                            </p>
                            {item.assignedTo && (
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    Assigned to {item.assignedTo.firstName || item.assignedTo.username}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const TABS = [
    { id: 'overview', label: 'Overview', icon: Calendar },
    { id: 'agenda', label: 'Agenda', icon: FileText },
    { id: 'notes', label: 'Shared notes', icon: Edit3 },
    { id: 'transcript', label: 'Transcript & summary', icon: Sparkles },
    { id: 'actions', label: 'Action items', icon: CheckSquare },
    { id: 'whiteboard', label: 'Whiteboard', icon: PenTool },
    { id: 'brainstorm', label: 'Brainstorm', icon: StickyNote },
];

const MeetingDetailPage = () => {
    const { meetingId, workspaceId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('overview');
    const [joining, setJoining] = useState(false);

    const {
        meeting, loading, error, room,
        endMeeting, updateAgenda, updateTranscript, generateSummary,
        addActionItem, updateActionItem,
    } = useMeeting(meetingId, workspaceId);

    // Join = go to the meeting's call: its conversation, or its huddle on the Huddles page.
    const handleJoin = () => {
        const path = meetingConversationPath(workspaceId, meeting);
        if (path) {
            showToast('Start or join the huddle from the conversation header.', 'info');
            navigate(path);
            return;
        }
        setJoining(true);
        navigate(`/workspace/${workspaceId}/huddles?meeting=${meetingId}`, { state: { meetingTitle: meeting.title } });
    };

    const handleEnd = async () => {
        try {
            await endMeeting();
            showToast('Meeting ended', 'info');
        } catch (err) {
            showToast(err?.response?.data?.message || 'Could not end the meeting', 'error');
        }
    };

    if (loading) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', fontFamily: FONT }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
                    <p style={ui.muted}>Loading meeting…</p>
                </div>
            </div>
        );
    }

    if (error || !meeting) {
        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', background: 'var(--bg-base)', fontFamily: FONT }}>
                <p style={{ fontSize: '14px', color: 'var(--state-danger)' }}>{error || 'Meeting not found'}</p>
                <button onClick={() => navigate(`/workspace/${workspaceId}/huddles?tab=scheduled`)} style={ui.secondary}>
                    <ArrowLeft size={14} /> Back to huddles
                </button>
            </div>
        );
    }

    const creator = meeting.createdBy?.firstName
        ? `${meeting.createdBy.firstName} ${meeting.createdBy.lastName || ''}`.trim()
        : meeting.createdBy?.username || '—';

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)', fontFamily: FONT }}>
            <header style={{ flexShrink: 0, padding: '14px 24px 0', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <button
                        onClick={() => navigate(`/workspace/${workspaceId}/huddles?tab=scheduled`)}
                        title="Back to huddles"
                        aria-label="Back to huddles"
                        style={{ ...ui.iconBtn, padding: '6px', border: '1px solid var(--border-default)' }}
                    >
                        <ArrowLeft size={15} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{meeting.title}</h1>
                            <StatusBadge status={meeting.status} />
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Organized by {creator}
                            {meeting.startTime ? ` · ${new Date(meeting.startTime).toLocaleDateString([], { dateStyle: 'medium' })}` : ''}
                        </p>
                    </div>
                </div>

                <div role="tablist" style={{ display: 'flex', gap: '2px', overflowX: 'auto' }}>
                    {TABS.map(tab => (
                        <TabBtn key={tab.id} label={tab.label} icon={tab.icon} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} />
                    ))}
                </div>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                {activeTab === 'overview' && (
                    <OverviewTab meeting={meeting} onJoin={handleJoin} onEnd={handleEnd} joining={joining} inConversation={!!meetingConversationPath(workspaceId, meeting)} />
                )}
                {activeTab === 'agenda' && <AgendaTab meeting={meeting} onSave={updateAgenda} />}
                {/* Kept mounted so live edits received here survive switching tabs. */}
                <div style={{ display: activeTab === 'notes' ? 'block' : 'none', height: '100%' }}>
                    <NotesTab meetingId={meetingId} room={room} fallbackNotes={meeting.sharedNotes || ''} />
                </div>
                {activeTab === 'transcript' && (
                    <TranscriptTab meeting={meeting} onSaveTranscript={updateTranscript} onGenerateSummary={generateSummary} />
                )}
                {activeTab === 'actions' && (
                    <ActionItemsTab meeting={meeting} onAdd={addActionItem} onUpdate={updateActionItem} />
                )}
                {activeTab === 'whiteboard' && <Whiteboard meetingId={meetingId} />}
                {activeTab === 'brainstorm' && <BrainstormBoard meetingId={meetingId} liveReady={room.joined} />}
            </div>
        </div>
    );
};

export default MeetingDetailPage;
