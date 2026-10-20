import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, UserPlus, Hash, Camera, Sparkles, NotebookPen, Download, X, ChevronRight } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import logger from '../../../utils/logger';
import InvitePeopleModal from '../../../components/InvitePeopleModal';

const APPS_URL = 'https://github.com/thrishankkuntimaddi/Oruniwan/releases/latest';

const hasOwnPhoto = (user) => Boolean(user?.profilePicture) && !/api\.dicebear\.com/.test(user.profilePicture);

/**
 * "Getting started" on the workspace home: a few first steps, ticked off as they happen.
 * Progress is saved on the account (preferences.gettingStarted), so it follows you across devices.
 * Some steps tick themselves (teammates joined, own photo); the rest tick when you open them.
 */
export default function GettingStarted({ workspaceId, compact = false, variant }) {
    const { user, setUser } = useAuth();
    const { activeWorkspace } = useWorkspace();
    const navigate = useNavigate();
    const saved = user?.preferences?.gettingStarted || { done: [], hidden: false };
    const [done, setDone] = useState(() => new Set(saved.done || []));
    const [hidden, setHidden] = useState(Boolean(saved.hidden));
    const [inviting, setInviting] = useState(false);

    const save = (patch) => {
        setUser((u) => (u ? { ...u, preferences: { ...(u.preferences || {}), gettingStarted: { done: [...done], hidden, ...patch } } } : u));
        api.put('/api/auth/me', { preferences: { gettingStarted: patch } })
            .catch((err) => logger.warn('Could not save getting-started progress', err));
    };

    const mark = (key) => {
        if (done.has(key)) return;
        const next = new Set(done).add(key);
        setDone(next);
        save({ done: [...next] });
    };

    const openGeneral = async () => {
        try {
            const { data } = await api.get(`/api/workspaces/${workspaceId}/channels`);
            const general = (data.channels || []).find((c) => c.name === 'general') || (data.channels || [])[0];
            if (general) navigate(`/workspace/${workspaceId}/home/channel/${general._id || general.id}`);
            else navigate(`/workspace/${workspaceId}/channels`);
        } catch {
            navigate(`/workspace/${workspaceId}/channels`);
        }
    };

    const steps = useMemo(() => [
        {
            key: 'invite', Icon: UserPlus, title: 'Invite your teammates', sub: 'Work is better together',
            auto: (activeWorkspace?.memberCount || 0) > 1,
            run: () => setInviting(true),
        },
        { key: 'message', Icon: Hash, title: 'Say hello in #general', sub: 'Send your first message', run: openGeneral },
        { key: 'profile', Icon: Camera, title: 'Add a profile photo', sub: 'Help your team recognise you', auto: hasOwnPhoto(user), run: () => navigate('/settings') },
        { key: 'ai', Icon: Sparkles, title: 'Ask Oruinwan AI anything', sub: 'Summaries, drafts and answers', run: () => window.dispatchEvent(new CustomEvent('chttrix-ai:open')) },
        { key: 'note', Icon: NotebookPen, title: 'Write your first note', sub: 'Plans, docs and meeting notes', run: () => navigate(`/workspace/${workspaceId}/notes`) },
        { key: 'apps', Icon: Download, title: 'Get the desktop and phone apps', sub: 'Stay in touch on the go', run: () => window.open(APPS_URL, '_blank', 'noopener') },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [activeWorkspace?.memberCount, user?.profilePicture, workspaceId]);

    const isDone = (s) => done.has(s.key) || s.auto;
    const finished = steps.filter(isDone).length;

    const invite = (
        <InvitePeopleModal isOpen={inviting} onClose={() => setInviting(false)} workspaceId={workspaceId} workspaceName={activeWorkspace?.name} />
    );
    if (hidden || finished === steps.length) return invite;

    return (
        <>
        {invite}
        <section className="gl-card" aria-labelledby="gs-title" data-testid="getting-started"
            style={variant === 'section'
                ? { padding: 18, textAlign: 'left' }
                : compact
                ? { margin: '8px 12px 0', padding: 14, textAlign: 'left' }
                : { width: '100%', maxWidth: 520, margin: '28px auto 0', padding: 18, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <h2 id="gs-title" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>Getting started</h2>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{finished} of {steps.length} done</span>
                <button type="button" className="gl-icon-btn" aria-label="Hide getting started"
                    onClick={() => { setHidden(true); save({ hidden: true }); }}>
                    <X size={14} />
                </button>
            </div>
            <div aria-hidden="true" style={{ height: 3, background: 'var(--bg-active)', marginBottom: 12 }}>
                <span style={{ display: 'block', height: '100%', width: `${(finished / steps.length) * 100}%`, background: 'var(--accent)', transition: 'width 300ms ease' }} />
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {steps.map((s) => {
                    const ok = isDone(s);
                    return (
                        <li key={s.key}>
                            <button type="button" className="gl-card--interactive"
                                onClick={() => { mark(s.key); s.run(); }}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 8px', background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left' }}>
                                <span aria-hidden="true" style={{
                                    width: 26, height: 26, display: 'grid', placeItems: 'center', flexShrink: 0,
                                    background: ok ? 'var(--state-success, #22c55e)' : 'var(--bg-active)', color: ok ? '#fff' : 'var(--text-secondary)',
                                }}>
                                    {ok ? <Check size={14} strokeWidth={3} /> : <s.Icon size={14} />}
                                </span>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: ok ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: ok ? 'line-through' : 'none' }}>{s.title}</span>
                                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>{s.sub}</span>
                                </span>
                                <span className="orw-sr" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{ok ? 'done' : 'not done yet'}</span>
                                <ChevronRight size={14} aria-hidden="true" style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
        </>
    );
}
