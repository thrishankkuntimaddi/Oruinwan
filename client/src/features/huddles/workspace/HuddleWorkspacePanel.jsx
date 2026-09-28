import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, NotebookPen, ListTodo, MessageSquare, Send } from 'lucide-react';
import { useHuddleContext, callTitle } from '../HuddleContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSocket } from '../../../contexts/SocketContext';
import { useContacts } from '../../../contexts/ContactsContext';
import useHuddleNotes from './useHuddleNotes';
import NotesTab from './NotesTab';
import TasksTab from './TasksTab';
import ChatTab from './ChatTab';
import WrapUpTab from './WrapUpTab';
import { formatDuration } from './wrapUp';
import './huddleWorkspace.css';

const TABS = [
    { id: 'notes', label: 'Notes', Icon: NotebookPen },
    { id: 'tasks', label: 'Tasks', Icon: ListTodo },
    { id: 'chat', label: 'Chat', Icon: MessageSquare },
    { id: 'wrapup', label: 'Wrap-up', Icon: Send },
];

const initials = (name = '') => name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

function useTicker(active) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!active) return undefined;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [active]);
    return now;
}

/**
 * The huddle workspace: notes, tasks, chat and wrap-up next to the call. It is
 * docked at the right edge of the app (the app shell makes room for it on wide
 * screens) and stays open after the call ends so the wrap-up can be posted.
 */
export default function HuddleWorkspacePanel() {
    const ctx = useHuddleContext();
    const { user } = useAuth();
    const { socket } = useSocket() || {};
    const contacts = useContacts() || {};
    const navigate = useNavigate();
    const call = ctx.panelCall;
    const live = !!call && call.status === 'live' && ctx.active && ctx.huddleId === call.id;
    const workspaceId = call?.workspaceId || ctx.workspaceId;
    const me = useMemo(() => ({ id: String(user?._id || user?.id || user?.sub || ''), username: user?.username || 'You' }), [user]);

    // Server session (participants, notes id, linked tasks), kept fresh by socket events.
    const [session, setSession] = useState(ctx.session);
    useEffect(() => { if (ctx.session) setSession(ctx.session); }, [ctx.session]);
    const { reloadSession } = ctx;
    useEffect(() => { if (call?.id) reloadSession(call.id); }, [call?.id, reloadSession]);
    useEffect(() => {
        if (!socket || !call?.id) return undefined;
        const onLinked = ({ huddleId, taskIds } = {}) => {
            if (huddleId === call.id) setSession((s) => (s ? { ...s, linkedTaskIds: taskIds || [] } : s));
        };
        const onWrapped = ({ huddleId, messageId, postedBy } = {}) => {
            if (huddleId === call.id) setSession((s) => (s ? { ...s, summary: { messageId, postedBy } } : s));
        };
        socket.on('huddle:tasks_linked', onLinked);
        socket.on('huddle:wrapped_up', onWrapped);
        return () => {
            socket.off('huddle:tasks_linked', onLinked);
            socket.off('huddle:wrapped_up', onWrapped);
        };
    }, [socket, call?.id]);

    useEffect(() => {
        document.body.classList.add('hw-docked');
        return () => document.body.classList.remove('hw-docked');
    }, []);

    const notes = useHuddleNotes({ huddleId: call?.id, live, socket, enabled: !!call?.id });

    // Where the huddle "lives" for chat and the wrap-up.
    const [pickedChannel, setPickedChannel] = useState(null);
    const channels = useMemo(() => (contacts.channels || []).filter((c) => c.isMember !== false), [contacts.channels]);
    const target = useMemo(() => {
        if (!call) return null;
        if (call.channelId) return { type: 'channel', id: call.channelId, name: call.channelName || session?.channelName || '' };
        if (call.dmId) return { type: 'dm', id: call.dmId, name: 'Direct message' };
        const picked = channels.find((c) => String(c.id) === String(pickedChannel));
        return picked ? { type: 'channel', id: String(picked.id), name: picked.label } : null;
    }, [call, session, channels, pickedChannel]);
    const targetHref = target && workspaceId ? `/workspace/${workspaceId}/${target.type === 'dm' ? 'dm' : 'channel'}/${target.id}` : null;

    const [taskChanges, setTaskChanges] = useState([]);
    const recordTaskChange = useCallback((c) => {
        setTaskChanges((prev) => {
            const i = prev.findIndex((x) => x.id === c.id);
            if (i < 0) return [...prev, c];
            const next = prev.slice();
            // "created" stays "created" even if it was moved afterwards.
            next[i] = prev[i].created ? { ...c, change: `created, ${c.change === 'created' ? 'To do' : c.change}`, created: true } : c;
            return next;
        });
    }, []);
    const [createFrom, setCreateFrom] = useState(null);

    const now = useTicker(live);
    const startedAt = session?.startedAt || call?.startTime;
    const endedAt = !live ? (call?.endTime || session?.endedAt) : null;
    const durationSec = startedAt ? Math.max(0, Math.round(((endedAt ? new Date(endedAt).getTime() : now) - new Date(startedAt).getTime()) / 1000)) : null;

    const people = useMemo(() => {
        if (live) return ctx.participants.map((p) => ({ id: String(p.userId), username: p.isLocal ? me.username : (p.username || 'Someone') }));
        return (session?.participants || []).map((p) => ({ id: p.userId, username: p.username }));
    }, [live, ctx.participants, session, me.username]);

    if (!call) return null;

    const notesHref = notes.noteId && workspaceId ? `/workspace/${workspaceId}/notes/${notes.noteId}` : null;
    const go = (href) => (e) => { e.preventDefault(); if (href) navigate(href); };
    const title = callTitle({ ...call, channelName: call.channelName || session?.channelName });
    const tab = ctx.workspaceTab;

    return (
        <aside className="hw-panel" data-testid="huddle-workspace" aria-label="Huddle workspace">
            <div className="hw-head">
                <div className="hw-head-titles">
                    <p className="hw-title">{title}</p>
                    <p className="hw-sub">
                        {live ? <span className="hw-live-dot" /> : null}
                        <span className={live ? '' : 'hw-ended'}>{live ? 'Live' : 'Call ended'}</span>
                        {durationSec != null && <><span>·</span><span>{formatDuration(durationSec)}</span></>}
                    </p>
                </div>
                <button type="button" className="gl-icon-btn" onClick={ctx.closeWorkspace} title="Close huddle workspace" aria-label="Close huddle workspace">
                    <X size={15} />
                </button>
            </div>
            {people.length > 0 && (
                <div className="hw-people" aria-label="People in the huddle" style={{ paddingTop: 8 }}>
                    {people.map((p) => (
                        <span key={p.id} className="hw-chip"><span className="hw-avatar">{initials(p.username)}</span>{p.id === me.id ? 'You' : p.username}</span>
                    ))}
                </div>
            )}
            <div className="hw-tabs-wrap">
                <div className="gl-tabs" role="tablist" aria-label="Huddle workspace">
                    {TABS.map(({ id, label, Icon }) => (
                        <button key={id} type="button" role="tab" className="gl-tab" aria-selected={tab === id} onClick={() => ctx.setWorkspaceTab(id)} data-testid={`huddle-tab-${id}`}>
                            <Icon size={12} /> {label}
                            {id === 'notes' && notes.actions.length > 0 && <span className="gl-count">{notes.actions.length}</span>}
                        </button>
                    ))}
                </div>
            </div>

            <div className={`hw-body${tab === 'chat' ? ' hw-body--flush' : ''}`} role="tabpanel">
                {tab === 'notes' && (
                    <NotesTab notes={notes} live={live} notesHref={notesHref} onOpenNotes={go(notesHref)}
                        onCreateTask={(a) => { setCreateFrom(a); ctx.setWorkspaceTab('tasks'); }} />
                )}
                {tab === 'tasks' && (
                    <TasksTab
                        huddleId={call.id}
                        live={live}
                        channelId={call.channelId || (target?.type === 'channel' ? target.id : null)}
                        workspaceId={workspaceId}
                        me={me}
                        people={people}
                        notes={notes}
                        session={session}
                        onSessionChange={(patch) => setSession((s) => (s ? { ...s, ...patch } : s))}
                        onTaskChanged={recordTaskChange}
                        createFrom={createFrom}
                        onCreateHandled={() => setCreateFrom(null)}
                        startedAt={startedAt}
                    />
                )}
                {tab === 'chat' && (
                    target
                        ? <ChatTab conversation={target} workspaceId={workspaceId} conversationHref={targetHref} onOpen={go(targetHref)} />
                        : <p className="hw-muted" style={{ padding: 14 }}>This is a workspace huddle. Choose a channel in Wrap-up to discuss it there.</p>
                )}
                {tab === 'wrapup' && (
                    <WrapUpTab
                        huddleId={call.id}
                        workspaceId={workspaceId}
                        title={title}
                        durationSec={durationSec}
                        participants={people.map((p) => p.username)}
                        notes={notes}
                        notesHref={notesHref}
                        taskChanges={taskChanges}
                        target={target}
                        channels={call.channelId || call.dmId ? null : channels}
                        onPickChannel={setPickedChannel}
                        session={session}
                        targetHref={targetHref}
                    />
                )}
            </div>
        </aside>
    );
}
