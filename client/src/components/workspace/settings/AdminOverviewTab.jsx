import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Hash, UserPlus, Users, Settings2, ShieldCheck, ArrowRight } from 'lucide-react';
import InvitePeopleModal from '../../InvitePeopleModal';
import { getConnections, setMembersMayConnect, useAgents } from '../../../features/agents/useAgents';
import { KpiGrid, Kpi, errorMessage } from '../../ui/page';
import { SettingSwitchRow } from '../../ui/SettingSwitch';
import { useToast } from '../../../contexts/ToastContext';

/** Workspace Admin → Overview: the numbers, and the things admins do most. */
export default function AdminOverviewTab({ workspace, stats, members = [], isAdmin, goTo }) {
    const [inviting, setInviting] = useState(false);
    const { agents } = useAgents(workspace?.id);
    const navigate = useNavigate();
    const installed = agents.filter((a) => a.installedForWorkspace);
    const admins = members.filter((m) => ['owner', 'admin'].includes(m.role)).length;

    const actions = [
        isAdmin && { Icon: UserPlus, label: 'Invite people', sub: 'Share a link or send emails', run: () => setInviting(true) },
        { Icon: Users, label: 'Manage members', sub: 'Roles, suspensions and removals', run: () => goTo('Members') },
        isAdmin && { Icon: Bot, label: 'Install agents', sub: 'Claude, ChatGPT, Gemini, Grok', run: () => navigate(`/workspace/${workspace?.id}/agents?tab=directory`) },
        isAdmin && { Icon: ShieldCheck, label: 'Permissions', sub: 'Who can invite and create channels', run: () => goTo('Permissions') },
        { Icon: Settings2, label: 'Workspace settings', sub: 'Name, icon, rules', run: () => goTo('General') },
    ].filter(Boolean);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <KpiGrid min={150}>
                <Kpi icon={Users} label="Members" hint={`${admins} admin${admins === 1 ? '' : 's'}`} value={stats?.memberCount ?? members.length} onClick={() => goTo('Members')} />
                <Kpi icon={Hash} label="Channels" value={stats?.channelCount} />
                <Kpi icon={Bot} label="Agents installed" value={installed.length} onClick={isAdmin ? () => goTo('Agents & apps') : undefined} />
            </KpiGrid>

            <section>
                <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Quick actions</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                    {actions.map(({ Icon, label, sub, run }) => (
                        <button key={label} type="button" className="gl-card gl-card--interactive" onClick={run}
                            style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer' }}>
                            <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', background: 'var(--bg-active)', flexShrink: 0 }}><Icon size={15} /></span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
                                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>{sub}</span>
                            </span>
                            <ArrowRight size={14} style={{ color: 'var(--text-secondary)' }} aria-hidden="true" />
                        </button>
                    ))}
                </div>
            </section>

            {stats?.createdAt && (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Created {new Date(stats.createdAt).toLocaleDateString()} by {stats.creator?.username || 'someone'}.
                </p>
            )}
            <InvitePeopleModal isOpen={inviting} onClose={() => setInviting(false)} workspaceId={workspace?.id} workspaceName={workspace?.name} />
        </div>
    );
}

/**
 * Workspace Admin → Agents & apps: what's installed for everyone, whether members may connect
 * their own (and how many do), with links to install more or set up tools.
 */
export function AdminAgentsTab({ workspaceId }) {
    const { agents, loading, policy } = useAgents(workspaceId);
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [counts, setCounts] = useState({});
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        if (!workspaceId) return;
        getConnections(workspaceId).then((d) => setCounts(d.counts || {})).catch(() => setCounts({}));
    }, [workspaceId, policy?.membersMayConnect]);
    const toggle = async (on) => {
        setSaving(true);
        try {
            await setMembersMayConnect(workspaceId, on);
            showToast(on ? 'Members can connect their own agents and tools' : 'Members’ own connections are off', 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Could not save the setting'), 'error');
        } finally {
            setSaving(false);
        }
    };
    const ownCount = (id) => counts[id] || 0;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Agents answer when someone chats with them or mentions them. Install one for everyone with a key your organisation pays for; members can also connect their own, just for themselves. Outside agents send questions to their company; Oruinwan AI stays on Oruinwan's servers.
            </p>
            <div className="gl-card" style={{ padding: '4px 14px' }} data-testid="members-may-connect">
                <SettingSwitchRow last
                    label="Members may connect their own agents and tools"
                    description="Their own Claude, ChatGPT, Gemini or Grok key, GitHub or Jira account. Only they can use it, and you never see their keys. Turning this off stops members' own connections being used; admins' still work."
                    checked={policy ? policy.membersMayConnect : true} disabled={!policy || saving} onChange={toggle} />
            </div>
            {loading ? <p style={{ color: 'var(--text-secondary)' }}>Loading…</p> : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {agents.map((a) => (
                        <li key={a.id} className="gl-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <img src={a.icon} alt="" width={32} height={32} style={{ borderRadius: 7 }} />
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{a.name} <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: 12 }}>· {a.maker}</span></span>
                                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>
                                    {a.builtIn ? 'Built in' : a.installedForWorkspace ? 'Installed for workspace' : 'Not installed for workspace'}
                                    {!a.builtIn && ownCount(a.id) > 0 && ` · ${ownCount(a.id)} ${ownCount(a.id) === 1 ? 'person uses' : 'people use'} their own`}
                                </span>
                            </span>
                            <button type="button" className={`gl-btn gl-btn--sm${a.installedForWorkspace ? '' : ' gl-btn--primary'}`}
                                onClick={() => navigate(`/workspace/${workspaceId}/agents?tab=directory`)}>
                                {a.installedForWorkspace ? 'Manage' : 'Install'}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="gl-btn" onClick={() => navigate(`/workspace/${workspaceId}/apps`)}>Apps and integrations</button>
                <button type="button" className="gl-btn" onClick={() => navigate(`/workspace/${workspaceId}/automations`)}>Workflows</button>
            </div>
        </div>
    );
}
