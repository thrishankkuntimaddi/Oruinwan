import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Calendar, Users, FileText, CheckSquare, Sparkles,
    Play, Square, Plus, Trash2, Edit3, Save,
    Clock, ArrowLeft, Loader2, PenTool, StickyNote,
} from 'lucide-react';
import Whiteboard from '../../components/meetingsComp/Whiteboard';
import BrainstormBoard from '../../components/meetingsComp/BrainstormBoard';
import { useMeeting, useSharedNotes } from '../../hooks/useMeeting';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

const StatusBadge = ({ status }) => {
    const map = {
        scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        live: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        completed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
        cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    };
    const pulse = status === 'live';
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${map[status] || map.scheduled}`}>
            {pulse && (
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
            )}
            {status?.charAt(0).toUpperCase() + status?.slice(1)}
        </span>
    );
};

const TabBtn = ({ label, icon: Icon, active, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
            active
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
    >
        <Icon size={15} />
        {label}
    </button>
);

const OverviewTab = ({ meeting, onJoin, onEnd, onSuggestTime, suggestLoading }) => {
    const [suggested, setSuggested] = useState(null);
    const [suggestErr, setSuggestErr] = useState('');

    const handleSuggest = async () => {
        setSuggestErr('');
        try {
            const result = await onSuggestTime(
                meeting.participants?.map(p => p._id) || [],
                meeting.duration || 30
            );
            setSuggested(result);
        } catch {
            setSuggestErr('Failed to suggest time');
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium uppercase tracking-wide">Start Time</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">
                        {meeting.startTime ? new Date(meeting.startTime).toLocaleString() : '—'}
                    </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium uppercase tracking-wide">Duration</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{meeting.duration || 30} min</p>
                </div>
            </div>

            {}
            <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Users size={15} /> Participants ({meeting.participants?.length || 0})
                </h4>
                <div className="flex flex-wrap gap-2">
                    {meeting.participants?.length > 0 ? (
                        meeting.participants.map(p => (
                            <span key={p._id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-700 dark:text-gray-300">
                                <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[9px] font-bold text-white">
                                    {(p.firstName?.[0] || p.username?.[0] || '?').toUpperCase()}
                                </div>
                                {p.firstName ? `${p.firstName} ${p.lastName || ''}` : p.username}
                            </span>
                        ))
                    ) : (
                        <p className="text-sm text-gray-400">No participants yet</p>
                    )}
                </div>
            </div>

            {}
            <div className="flex flex-wrap gap-3">
                {meeting.status === 'scheduled' && (
                    <button
                        onClick={onJoin}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/25 hover:scale-[1.02]"
                    >
                        <Play size={16} /> Join Meeting
                    </button>
                )}
                {meeting.status === 'live' && (
                    <>
                        <button
                            onClick={onJoin}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/25"
                        >
                            <Play size={16} /> Join Live
                        </button>
                        <button
                            onClick={onEnd}
                            className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-all"
                        >
                            <Square size={16} /> End Meeting
                        </button>
                    </>
                )}
                <button
                    onClick={handleSuggest}
                    disabled={suggestLoading}
                    className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-sm"
                >
                    <Clock size={15} /> Find Time
                </button>
            </div>

            {suggested && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase mb-1">Suggested Slot</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{new Date(suggested.suggestedStart).toLocaleString()} — {new Date(suggested.suggestedEnd).toLocaleTimeString()}</p>
                    <p className="text-xs text-gray-400 mt-1">{suggested.note}</p>
                </div>
            )}
            {suggestErr && <p className="text-sm text-red-500">{suggestErr}</p>}
        </div>
    );
};

const AgendaTab = ({ meeting, onSave }) => {
    const [items, setItems] = useState(meeting.agenda || []);
    const [newTitle, setNewTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const [editingIdx, setEditingIdx] = useState(null);

    const addItem = () => {
        if (!newTitle.trim()) return;
        setItems(prev => [...prev, { title: newTitle.trim(), notes: '', order: prev.length }]);
        setNewTitle('');
    };

    const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

    const saveAgenda = async () => {
        setSaving(true);
        try {
            await onSave(items.map((it, i) => ({ ...it, order: i })));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <input
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addItem()}
                    placeholder="Add agenda item…"
                    className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-white placeholder-gray-400"
                />
                <button
                    onClick={addItem}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-1.5 text-sm font-medium"
                >
                    <Plus size={15} /> Add
                </button>
            </div>

            <div className="space-y-2">
                {items.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">No agenda items yet. Add one above.</p>
                )}
                {items.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold mt-0.5">{idx + 1}</span>
                        <div className="flex-1">
                            {editingIdx === idx ? (
                                <input
                                    autoFocus
                                    value={item.title}
                                    onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, title: e.target.value } : it))}
                                    onBlur={() => setEditingIdx(null)}
                                    className="w-full text-sm bg-transparent border-b border-indigo-400 focus:outline-none text-gray-800 dark:text-white"
                                />
                            ) : (
                                <p className="text-sm font-medium text-gray-800 dark:text-white">{item.title}</p>
                            )}
                            {item.notes && <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>}
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => setEditingIdx(idx)} className="p-1 text-gray-400 hover:text-indigo-500 transition-colors">
                                <Edit3 size={13} />
                            </button>
                            <button onClick={() => removeItem(idx)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                                <Trash2 size={13} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={saveAgenda}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm transition-all disabled:opacity-60"
            >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Agenda
            </button>
        </div>
    );
};

const NotesTab = ({ meetingId, initialNotes }) => {
    const { notes, handleNotesChange } = useSharedNotes(meetingId, initialNotes);

    return (
        <div className="h-full flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Synced in realtime with all meeting participants
            </div>
            <textarea
                value={notes}
                onChange={e => handleNotesChange(e.target.value)}
                placeholder="Start typing shared notes… all participants see changes live."
                className="flex-1 w-full min-h-[300px] p-4 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-gray-200 placeholder-gray-400 resize-none font-mono leading-relaxed"
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
        } catch {
            showToast('Failed to save transcript', 'error');
        } finally {
            setSaving(false);
        }
    };

    const generateSummary = async () => {
        setGenerating(true);
        try {
            const result = await onGenerateSummary();
            setSummary(result);
            showToast('Summary generated!', 'success');
        } catch {
            showToast('Failed to generate summary', 'error');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Transcript</h4>
                    <button
                        onClick={saveTranscript}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium transition-all"
                    >
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                    </button>
                </div>
                <textarea
                    value={transcript}
                    onChange={e => setTranscript(e.target.value)}
                    placeholder="Paste or type the meeting transcript here…"
                    className="w-full h-40 p-3 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-gray-200 placeholder-gray-400 resize-none font-mono"
                />
            </div>

            <div>
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <Sparkles size={14} className="text-amber-500" /> AI Summary
                    </h4>
                    <button
                        onClick={generateSummary}
                        disabled={generating}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {generating ? 'Generating…' : 'Generate Summary'}
                    </button>
                </div>
                {summary ? (
                    <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{summary}</p>
                    </div>
                ) : (
                    <p className="text-sm text-gray-400 text-center py-6">No summary yet. Add a transcript and click "Generate Summary".</p>
                )}
            </div>
        </div>
    );
};

const STATUS_COLORS = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const ActionItemsTab = ({ meeting, onAdd, onUpdate }) => {
    const [newText, setNewText] = useState('');
    const [adding, setAdding] = useState(false);

    const handleAdd = async () => {
        if (!newText.trim()) return;
        setAdding(true);
        try {
            await onAdd({ text: newText.trim() });
            setNewText('');
        } finally {
            setAdding(false);
        }
    };

    const cycleStatus = async (item) => {
        const next = { pending: 'in_progress', in_progress: 'done', done: 'pending' };
        await onUpdate(item._id, { status: next[item.status] || 'pending' });
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <input
                    value={newText}
                    onChange={e => setNewText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder="Add action item…"
                    className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-white placeholder-gray-400"
                />
                <button
                    onClick={handleAdd}
                    disabled={adding}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-1.5 text-sm font-medium disabled:opacity-60"
                >
                    {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
                    Add
                </button>
            </div>

            <div className="space-y-2">
                {meeting.actionItems?.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">No action items yet.</p>
                )}
                {meeting.actionItems?.map(item => (
                    <div key={item._id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                        <button
                            onClick={() => cycleStatus(item)}
                            className={`mt-0.5 px-2 py-0.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all hover:scale-105 ${STATUS_COLORS[item.status] || STATUS_COLORS.pending}`}
                        >
                            {item.status?.replace('_', ' ')}
                        </button>
                        <div className="flex-1">
                            <p className={`text-sm font-medium ${item.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-white'}`}>
                                {item.text}
                            </p>
                            {item.assignedTo && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                    → {item.assignedTo.firstName || item.assignedTo.username}
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
    { id: 'notes', label: 'Shared Notes', icon: Edit3 },
    { id: 'transcript', label: 'Transcript & Summary', icon: Sparkles },
    { id: 'actions', label: 'Action Items', icon: CheckSquare },
    { id: 'whiteboard', label: 'Whiteboard', icon: PenTool },
    { id: 'brainstorm', label: 'Brainstorm', icon: StickyNote },
];

const MeetingDetailPage = () => {
    const { meetingId, workspaceId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('overview');
    const [suggestLoading, setSuggestLoading] = useState(false);

    const {
        meeting, loading, error,
        joinMeeting, endMeeting, updateAgenda, updateTranscript, generateSummary,
        addActionItem, updateActionItem, suggestTime,
    } = useMeeting(meetingId, workspaceId);

    const handleJoin = async () => {
        try {
            await joinMeeting();
            showToast('Joined meeting!', 'success');
        } catch (err) {
            showToast(err?.response?.data?.message || 'Failed to join meeting', 'error');
        }
    };

    const handleEnd = async () => {
        try {
            await endMeeting();
            showToast('Meeting ended', 'info');
        } catch (err) {
            showToast('Failed to end meeting', 'error');
        }
    };

    const handleSuggestTime = async (...args) => {
        setSuggestLoading(true);
        try { return await suggestTime(...args); }
        finally { setSuggestLoading(false); }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 size={32} className="animate-spin text-indigo-500" />
                    <p className="text-sm text-gray-500">Loading meeting…</p>
                </div>
            </div>
        );
    }

    if (error || !meeting) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-950">
                <p className="text-red-500 text-sm">{error || 'Meeting not found'}</p>
                <button onClick={() => navigate(-1)} className="text-indigo-500 text-sm hover:underline flex items-center gap-1">
                    <ArrowLeft size={14} /> Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden">
            {}
            <header className="flex-none px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3 mb-2">
                    <button
                        onClick={() => navigate(`/workspace/${workspaceId}/huddles`)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{meeting.title}</h1>
                            <StatusBadge status={meeting.status} />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Created by {meeting.createdBy?.firstName || meeting.createdBy?.username || '—'} ·{' '}
                            {meeting.startTime ? new Date(meeting.startTime).toLocaleDateString() : ''}
                        </p>
                    </div>
                </div>

                {}
                <div className="flex gap-1 overflow-x-auto pb-1 mt-2">
                    {TABS.map(tab => (
                        <TabBtn
                            key={tab.id}
                            label={tab.label}
                            icon={tab.icon}
                            active={activeTab === tab.id}
                            onClick={() => setActiveTab(tab.id)}
                        />
                    ))}
                </div>
            </header>

            {}
            <div className="flex-1 overflow-y-auto px-6 py-6">
                {activeTab === 'overview' && (
                    <OverviewTab
                        meeting={meeting}
                        onJoin={handleJoin}
                        onEnd={handleEnd}
                        onSuggestTime={handleSuggestTime}
                        suggestLoading={suggestLoading}
                    />
                )}
                {activeTab === 'agenda' && (
                    <AgendaTab meeting={meeting} onSave={updateAgenda} />
                )}
                {activeTab === 'notes' && (
                    <NotesTab meetingId={meetingId} initialNotes={meeting.sharedNotes || ''} />
                )}
                {activeTab === 'transcript' && (
                    <TranscriptTab
                        meeting={meeting}
                        onSaveTranscript={updateTranscript}
                        onGenerateSummary={generateSummary}
                    />
                )}
                {activeTab === 'actions' && (
                    <ActionItemsTab
                        meeting={meeting}
                        onAdd={addActionItem}
                        onUpdate={updateActionItem}
                    />
                )}
                {activeTab === 'whiteboard' && (
                    <Whiteboard meetingId={meetingId} workspaceId={workspaceId} />
                )}
                {activeTab === 'brainstorm' && (
                    <BrainstormBoard meetingId={meetingId} workspaceId={workspaceId} />
                )}
            </div>
        </div>
    );
};

export default MeetingDetailPage;
