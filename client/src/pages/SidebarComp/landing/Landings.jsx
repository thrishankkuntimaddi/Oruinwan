import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    AtSign, Bot, CalendarClock, Hash, Lock, MessageSquare, MessageSquarePlus, Plus, Search, Sparkles,
    UserPlus, CalendarPlus, ArrowRight, Users,
} from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useContacts } from '../../../contexts/ContactsContext';
import { useToast } from '../../../contexts/ToastContext';
import { useNotifications } from '../../../features/notifications/NotificationsContext';
import { useScheduledMeetings } from '../../../hooks/useScheduledMeetings';
import { openAgentDm, useAgents } from '../../../features/agents/useAgents';
import InvitePeopleModal from '../../../components/InvitePeopleModal';
import GettingStarted from '../states/GettingStarted';
import { HuddlesHome } from '../../../features/meetings/HuddlesLists';
import {
    DashPage, PageHead, Section, Panel, KpiGrid, Kpi, Grid, Toolbar, SearchBox, FilterTabs, Btn, Chip, EmptyState, Avatar,
} from '../../../components/ui/page';

/* Landing pages: what the main area shows when nothing is open in Home, Channels, Messages
   and Huddles. Each one answers "what can I do here, and what needs me?" instead of a bare
   welcome. Events let the side panels' own dialogs open from here. */
export const CREATE_CHANNEL_EVENT = 'oruinwan:create-channel';

const greeting = () => {
    const h = new Date().getHours();
    return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

const fmtTime = (d) => new Date(d).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });

/** A row in a list panel: the whole row opens it. */
function Row({ icon, title, sub, right, onClick, testId }) {
    return (
        <button type="button" onClick={onClick} data-testid={testId} className="ld-row">
            <span className="ld-row-icon">{icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
                <span className="ld-row-title">{title}</span>
                {sub && <span className="ld-row-sub">{sub}</span>}
            </span>
            {right}
        </button>
    );
}

const LANDING_CSS = `
.ld-row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: none; border: 0; border-top: 1px solid var(--border-subtle); text-align: left; cursor: pointer; font-family: var(--font); color: inherit; }
.ld-row:first-child { border-top: 0; }
.ld-row:hover { background: var(--bg-hover); }
.ld-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.ld-row-icon { width: 32px; height: 32px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--text-secondary); background: var(--bg-active); border: 1px solid var(--border-subtle); border-radius: var(--gl-radius); overflow: hidden; }
.ld-row-title { display: block; font-size: 13.5px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ld-row-sub { display: block; font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ld-two { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 20px; align-items: start; }
@media (max-width: 1100px) { .ld-two { grid-template-columns: minmax(0, 1fr); } }
.ld-tile { padding: 16px; display: flex; flex-direction: column; gap: 8px; text-align: left; font-family: var(--font); color: inherit; }
.ld-tile-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: var(--text-primary); }
.ld-tile-text { font-size: 12.5px; line-height: 1.5; color: var(--text-secondary); }
`;
const LandingStyles = () => <style>{LANDING_CSS}</style>;

/* ── Workspace home ───────────────────────────────────────────────────── */

export function HomeLanding() {
    const { workspaceId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { activeWorkspace } = useWorkspace();
    const contacts = useContacts();
    const notif = useNotifications();
    const { meetings } = useScheduledMeetings(workspaceId);
    const { agents } = useAgents(workspaceId);
    const { showToast } = useToast();
    const [inviting, setInviting] = useState(false);

    const isAdmin = ['owner', 'admin'].includes(activeWorkspace?.role) || activeWorkspace?.isOwner;
    const unread = (notif?.unreadTotals?.dm || 0) + (notif?.unreadTotals?.channel || 0);
    const firstName = String(user?.username || '').split(' ')[0];

    // Conversations that need you first (mentions, then unread), then the rest.
    const conversations = useMemo(() => {
        const list = [
            ...(contacts?.channels || []).filter((c) => c.isMember).map((c) => ({ ...c, kind: 'channel' })),
            ...(contacts?.dms || []).map((d) => ({ ...d, kind: 'dm' })),
        ].map((c) => ({ ...c, unread: notif?.getUnread?.(c.kind, c.id) || c.unreadCount || 0, mention: notif?.hasMention?.(c.kind, c.id) || false }));
        // Mentions and unread first, then the most recent conversations.
        const recent = (c) => Date.parse(c.lastAt || 0) || 0;
        return list.sort((a, b) => Number(b.mention) - Number(a.mention) || b.unread - a.unread || recent(b) - recent(a)).slice(0, 6);
    }, [contacts?.channels, contacts?.dms, notif]);
    const mentions = conversations.filter((c) => c.mention).length;
    // Up next: meetings for everyone, ones I organise, and ones I'm invited to (the server drops finished ones).
    const myId = String(user?.id || user?._id || user?.sub || '');
    const upcoming = (meetings || []).filter((m) => {
        const invited = (m.participants || []).map((p) => String(p?._id || p));
        return invited.length === 0 || invited.includes(myId) || String(m.createdBy?._id || m.createdBy) === myId;
    }).slice(0, 3);
    const installed = agents.filter((a) => a.installed);

    const open = (c) => navigate(c.kind === 'channel' ? `/workspace/${workspaceId}/home/channel/${c.id}` : `/workspace/${workspaceId}/home/dm/${c.id}`);
    const chatAgent = async (a) => {
        try {
            navigate(`/workspace/${workspaceId}/home/dm/${await openAgentDm(workspaceId, a.id)}`);
        } catch (err) {
            showToast(err.response?.data?.message || `Couldn't open ${a.name}`, 'error');
        }
    };

    const summary = [
        unread ? `${unread} unread` : null,
        mentions ? `${mentions} mention${mentions === 1 ? '' : 's'}` : null,
        upcoming.length ? `${upcoming.length} upcoming meeting${upcoming.length === 1 ? '' : 's'}` : null,
    ].filter(Boolean).join(' · ');

    return (
        <DashPage head={(
            <PageHead
                eyebrow={activeWorkspace?.name || 'Workspace'}
                title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
                lead={summary || 'You’re all caught up.'}
                actions={(
                    <>
                        <Btn variant="ghost" icon={Sparkles} onClick={() => window.dispatchEvent(new CustomEvent('oruinwan-ai:open'))}>Ask AI</Btn>
                        {isAdmin && <Btn variant="primary" icon={UserPlus} onClick={() => setInviting(true)}>Invite people</Btn>}
                    </>
                )}
            />
        )}>
            <LandingStyles />
            <KpiGrid min={150}>
                <Kpi label="Unread" value={unread} icon={MessageSquare} tone={unread ? undefined : 'muted'} />
                <Kpi label="Mentions" value={mentions} icon={AtSign} tone={mentions ? undefined : 'muted'} />
                <Kpi label="Upcoming meetings" value={upcoming.length} icon={CalendarClock} tone="muted" onClick={() => navigate(`/workspace/${workspaceId}/huddles`)} />
                <Kpi label="Agents" value={installed.length} icon={Bot} tone="muted" onClick={() => navigate(`/workspace/${workspaceId}/agents`)} />
            </KpiGrid>

            <div className="ld-two">
                <Section title="Jump back in" lead="Mentions and unread first.">
                    <Panel flush>
                        {conversations.length === 0 ? (
                            <EmptyState icon={Hash} title="No conversations yet" text="Join a channel or message a teammate to get going."
                                action={<Btn variant="primary" size="sm" icon={Hash} onClick={() => navigate(`/workspace/${workspaceId}/channels`)}>Browse channels</Btn>} />
                        ) : conversations.map((c) => (
                            <Row key={`${c.kind}${c.id}`} onClick={() => open(c)}
                                icon={c.kind === 'channel' ? (c.isPrivate ? <Lock size={14} /> : <Hash size={14} />) : <Avatar name={c.label} src={c.avatar} size={32} />}
                                title={c.kind === 'channel' ? `#${c.label}` : c.label}
                                sub={c.kind === 'channel' ? (c.description || 'Channel') : 'Direct message'}
                                right={c.mention ? <Chip tone="accent">@ mention</Chip> : c.unread ? <Chip tone="accent">{c.unread} new</Chip> : null} />
                        ))}
                    </Panel>
                </Section>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <Section title="Up next" action={<Btn size="sm" variant="ghost" icon={CalendarPlus} onClick={() => navigate(`/workspace/${workspaceId}/huddles`)}>Schedule</Btn>}>
                        <Panel flush>
                            {upcoming.length === 0 ? (
                                <EmptyState icon={CalendarClock} title="Nothing scheduled" text="Meetings you schedule or are invited to show up here." />
                            ) : upcoming.map((m) => (
                                <Row key={m._id} icon={<CalendarClock size={14} />} title={m.title} sub={`${fmtTime(m.startTime)}${m.duration ? ` · ${m.duration} min` : ''}`}
                                    right={m.status === 'live' ? <Chip tone="success">Live</Chip> : null}
                                    onClick={() => navigate(`/workspace/${workspaceId}/meetings/${m._id}`)} />
                            ))}
                        </Panel>
                    </Section>
                    <Section title="Ask an agent" action={<Btn size="sm" variant="ghost" icon={Plus} onClick={() => navigate(`/workspace/${workspaceId}/agents?tab=directory`)}>Add</Btn>}>
                        <Panel flush>
                            {installed.map((a) => (
                                <Row key={a.id} icon={<img src={a.icon} alt="" width={32} height={32} />} title={a.name} sub={a.tagline} onClick={() => chatAgent(a)} />
                            ))}
                        </Panel>
                    </Section>
                </div>
            </div>

            <GettingStarted workspaceId={workspaceId} variant="section" />
            <InvitePeopleModal isOpen={inviting} onClose={() => setInviting(false)} workspaceId={workspaceId} workspaceName={activeWorkspace?.name} />
        </DashPage>
    );
}

/* ── Channels ─────────────────────────────────────────────────────────── */

export function ChannelsLanding() {
    const { workspaceId } = useParams();
    const navigate = useNavigate();
    const { activeWorkspace } = useWorkspace();
    const contacts = useContacts();
    const notif = useNotifications();
    const { showToast } = useToast();
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [joining, setJoining] = useState(null);

    const channels = contacts?.channels || [];
    const q = query.trim().toLowerCase();
    const shown = channels
        .filter((c) => (filter === 'all' || (filter === 'joined' ? c.isMember : !c.isMember)) && (!q || `${c.label} ${c.description || ''}`.toLowerCase().includes(q)))
        .sort((a, b) => Number(b.isMember) - Number(a.isMember) || a.label.localeCompare(b.label));
    const joinedCount = channels.filter((c) => c.isMember).length;

    const open = (c) => navigate(`/workspace/${workspaceId}/channel/${c.id}`);
    const join = async (c) => {
        setJoining(c.id);
        try {
            await api.post(`/api/channels/${c.id}/join`);
            await contacts?.refreshContacts?.();
            showToast(`Joined #${c.label}`, 'success');
            open(c);
        } catch (err) {
            showToast(err.response?.data?.message || `Couldn't join #${c.label}`, 'error');
        } finally {
            setJoining(null);
        }
    };

    return (
        <DashPage head={(
            <PageHead
                eyebrow={activeWorkspace?.name || 'Workspace'}
                title="Channels"
                icon={Hash}
                lead="Conversations organised by topic. Join any public channel, or create one for a project."
                actions={<Btn variant="primary" icon={Plus} onClick={() => window.dispatchEvent(new CustomEvent(CREATE_CHANNEL_EVENT))}>Create channel</Btn>}
            />
        )}>
            <LandingStyles />
            <Toolbar>
                <SearchBox value={query} onChange={setQuery} placeholder="Find a channel" label="Find a channel" />
                <FilterTabs value={filter} onChange={setFilter} label="Show" options={[
                    { value: 'all', label: 'All', count: channels.length },
                    { value: 'joined', label: 'Joined', count: joinedCount },
                    { value: 'other', label: 'Not joined', count: channels.length - joinedCount },
                ]} />
            </Toolbar>
            {shown.length === 0 ? (
                <Panel>
                    <EmptyState icon={Search} title={q ? 'No channels match' : 'No channels here'} text={q ? 'Try another name.' : 'Create a channel for a team, project or topic.'} />
                </Panel>
            ) : (
                <Grid min={260}>
                    {shown.map((c) => {
                        const unread = notif?.getUnread?.('channel', c.id) || 0;
                        return (
                            <div key={c.id} className="gl-card ld-tile" data-testid={`channel-card-${c.label}`}>
                                <span className="ld-tile-title">
                                    {c.isPrivate ? <Lock size={14} style={{ color: 'var(--text-secondary)' }} /> : <Hash size={14} style={{ color: 'var(--accent)' }} />}
                                    {c.label}
                                    {unread > 0 && <Chip tone="accent">{unread} new</Chip>}
                                </span>
                                <span className="ld-tile-text" style={{ minHeight: 38 }}>{c.description || 'No description yet.'}</span>
                                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    {c.isMember ? (
                                        <>
                                            <Btn size="sm" icon={ArrowRight} onClick={() => open(c)}>Open</Btn>
                                            <Chip tone="success">Joined</Chip>
                                        </>
                                    ) : (
                                        <Btn size="sm" variant="primary" loading={joining === c.id} onClick={() => join(c)}>Join channel</Btn>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </Grid>
            )}
        </DashPage>
    );
}

/* ── Messages ─────────────────────────────────────────────────────────── */

export function MessagesLanding({ onNewMessage }) {
    const { workspaceId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { activeWorkspace } = useWorkspace();
    const contacts = useContacts();
    const notif = useNotifications();
    const { agents } = useAgents(workspaceId);
    const { showToast } = useToast();
    const [query, setQuery] = useState('');

    const me = String(user?._id || user?.id || '');
    const dms = (contacts?.dms || []).map((d) => ({ ...d, unread: notif?.getUnread?.('dm', d.id) || d.unreadCount || 0 }))
        .sort((a, b) => b.unread - a.unread || (Date.parse(b.lastAt || 0) || 0) - (Date.parse(a.lastAt || 0) || 0)).slice(0, 8);
    const withDm = new Set((contacts?.dms || []).map((d) => String(d.userId)));
    const q = query.trim().toLowerCase();
    // People you haven't talked to yet (the ones you already talk to are under Recent).
    const people = (contacts?.members || [])
        .filter((m) => String(m.id) !== me && !withDm.has(String(m.id)) && (!q || `${m.username} ${m.email}`.toLowerCase().includes(q)));
    const installed = agents.filter((a) => a.installed);

    const message = (m) => navigate(`/workspace/${workspaceId}/messages/dm/${m.id}`);
    const chatAgent = async (a) => {
        try {
            navigate(`/workspace/${workspaceId}/home/dm/${await openAgentDm(workspaceId, a.id)}`);
        } catch (err) {
            showToast(err.response?.data?.message || `Couldn't open ${a.name}`, 'error');
        }
    };

    return (
        <DashPage head={(
            <PageHead
                eyebrow={activeWorkspace?.name || 'Workspace'}
                title="Direct messages"
                icon={MessageSquare}
                lead="Private conversations with teammates and AI agents. End-to-end encrypted."
                actions={<Btn variant="primary" icon={MessageSquarePlus} onClick={onNewMessage}>New message</Btn>}
            />
        )}>
            <LandingStyles />
            {dms.length > 0 && (
                <Section title="Recent">
                    <Panel flush>
                        {dms.map((d) => (
                            <Row key={d.id} icon={<Avatar name={d.label} src={d.avatar} size={32} />} title={d.label}
                                sub={d.lastMessage && !/^🔒/.test(d.lastMessage) ? d.lastMessage : 'Direct message'}
                                right={d.unread ? <Chip tone="accent">{d.unread} new</Chip> : null}
                                onClick={() => navigate(`/workspace/${workspaceId}/messages/dm/${d.id}`)} />
                        ))}
                    </Panel>
                </Section>
            )}

            <Section title="Start a conversation" lead="People you haven’t messaged yet." action={<SearchBox value={query} onChange={setQuery} placeholder="Find a person" label="Find a person" />}>
                {people.length === 0 ? (
                    <Panel>
                        <EmptyState icon={Users} title={q ? 'No one matches' : 'It’s just you so far'} text={q ? 'Try another name or email.' : 'Invite teammates from Workspace admin or the workspace menu.'} />
                    </Panel>
                ) : (
                    <Panel flush>
                        {people.slice(0, 24).map((m) => (
                            <Row key={m.id} icon={<Avatar name={m.username} src={m.profilePicture} size={32} />} title={m.username} sub={m.email}
                                right={<Chip>Message</Chip>} onClick={() => message(m)} />
                        ))}
                    </Panel>
                )}
            </Section>

            {installed.length > 0 && (
                <Section title="Agents" lead="AI teammates: every message gets an answer.">
                    <Panel flush>
                        {installed.map((a) => (
                            <Row key={a.id} icon={<img src={a.icon} alt="" width={32} height={32} />} title={a.name} sub={a.tagline || a.maker}
                                right={<Chip tone="accent">Chat</Chip>} onClick={() => chatAgent(a)} />
                        ))}
                    </Panel>
                </Section>
            )}
        </DashPage>
    );
}

/* ── Huddles ──────────────────────────────────────────────────────────── */

/** The Huddles page: Live now · Upcoming · Past (features/meetings/HuddlesLists). */
export function HuddlesLanding(props) {
    return <HuddlesHome {...props} />;
}
