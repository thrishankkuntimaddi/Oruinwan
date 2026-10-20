import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Bot, Check, ExternalLink, Github, KeyRound, MessageSquare, Plus, Puzzle, Search, ShieldAlert, Sparkles, Trash2, User, Users, Workflow } from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { DashPage, PageHead, Toolbar, FilterTabs, SearchBox, Btn, Chip, Dialog, Field, LoadingState, ErrorState, EmptyState, errorMessage } from '../../components/ui/page';
import { useToast } from '../../contexts/ToastContext';
import {
    connectOwnAgent, connectOwnGithubToken, connectOwnJira, disconnectOwn, installAgent, openAgentDm,
    startGithubAuthorize, uninstallAgent, useAgents,
} from '../../features/agents/useAgents';

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: 14 };
const muted = { margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' };
const TOOL_ICON = { github: '/integrations/github.svg', jira: '/integrations/jira.svg', zoom: '/integrations/zoom.svg' };

function AgentIcon({ agent, size = 40 }) {
    return <img src={agent.icon || '/icons/oruinwan-128.png'} alt="" width={size} height={size} style={{ borderRadius: size * 0.22, flexShrink: 0 }} />;
}

/** The chips that say where an agent comes from for you: built in, yours, the workspace's. */
function AgentStatus({ agent }) {
    if (agent.builtIn) return <Chip tone="success"><Check size={11} /> Built in</Chip>;
    return (
        <>
            {agent.connectedForYou && <Chip tone="accent" title={agent.inUse === 'personal' ? 'Your own key answers you' : 'Not in use: personal connections are off here'}><User size={11} /> Connected for you</Chip>}
            {agent.installedForWorkspace && <Chip tone="success"><Users size={11} /> Installed for workspace</Chip>}
        </>
    );
}

function AgentCard({ agent, onOpen, onChat }) {
    return (
        <article className="gl-card gl-card--interactive" data-testid={`agent-card-${agent.id}`}
            style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer' }}
            onClick={() => onOpen(agent)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(agent); }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <AgentIcon agent={agent} />
                <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{agent.name}</h3>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{agent.maker}</p>
                </div>
            </div>
            <p style={{ ...muted, flex: 1 }}>{agent.tagline}</p>
            {(agent.builtIn || agent.connectedForYou || agent.installedForWorkspace) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><AgentStatus agent={agent} /></div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
                {agent.installed ? (
                    <>
                        <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" onClick={(e) => { e.stopPropagation(); onChat(agent); }}>
                            <MessageSquare size={13} /> Chat
                        </button>
                        {!agent.builtIn && <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" onClick={(e) => { e.stopPropagation(); onOpen(agent); }}>Manage</button>}
                    </>
                ) : (
                    <button type="button" className="gl-btn gl-btn--sm" onClick={(e) => { e.stopPropagation(); onOpen(agent); }} data-testid={`agent-connect-${agent.id}`}>Connect</button>
                )}
            </div>
        </article>
    );
}

/** One "who it's connected for" row in the agent dialog. */
function ScopeRow({ icon: Icon, title, status, tone, children, testId }) {
    return (
        <div className="gl-card" data-testid={testId} style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', background: 'var(--bg-active)', color: tone ? `var(--${tone})` : 'var(--text-secondary)', flexShrink: 0 }}><Icon size={15} /></span>
            <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{status}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
        </div>
    );
}

/**
 * An agent: what it is, how it's connected for you and for the workspace, and the key step.
 * Anthropic, OpenAI, Google and xAI don't let other apps sign people in to their accounts, so
 * connecting is an API key from that company (checked live before it's saved).
 */
function AgentDialog({ agent, workspaceId, workspaceName, canManage, policy, onClose, onChat }) {
    const { showToast } = useToast();
    const [scope, setScope] = useState(null); // null: overview · 'personal' | 'workspace': the key step
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const canConnectOwn = Boolean(policy?.canConnectOwn);
    const own = agent.connectedForYou;

    const submit = async () => {
        if (!apiKey.trim()) { setError(`Paste your ${agent.authorization?.label || 'API key'}`); return; }
        setBusy(true);
        setError('');
        try {
            if (scope === 'personal') await connectOwnAgent(workspaceId, agent.id, apiKey.trim(), model.trim());
            else await installAgent(workspaceId, agent.id, apiKey.trim(), model.trim());
            showToast(scope === 'personal' ? `${agent.name} is connected for you` : `${agent.name} is installed for everyone in ${workspaceName || 'this workspace'}`, 'success');
            setScope(null);
            setApiKey('');
            setModel('');
        } catch (err) {
            setError(errorMessage(err, `Couldn't connect ${agent.name}`));
        } finally {
            setBusy(false);
        }
    };

    const run = async (fn, done) => {
        setBusy(true);
        try { await fn(); showToast(done, 'success'); } catch (err) { showToast(errorMessage(err, 'That didn’t work'), 'error'); } finally { setBusy(false); }
    };

    const inUseText = agent.inUse === 'personal' ? `${agent.name} answers you with your own key.`
        : agent.inUse === 'workspace' ? `${agent.name} answers you with the workspace’s key.` : null;

    const footer = scope ? (
        <>
            <Btn variant="ghost" onClick={() => { setScope(null); setError(''); }} disabled={busy}>Back</Btn>
            <Btn variant="primary" icon={KeyRound} loading={busy} onClick={submit} data-testid="agent-authorize">
                {busy ? 'Checking the key…' : scope === 'personal' ? 'Check and connect' : 'Check and install'}
            </Btn>
        </>
    ) : agent.installed ? (
        <Btn variant="primary" icon={MessageSquare} onClick={() => onChat(agent)} data-testid="agent-open-chat">Chat with {agent.name}</Btn>
    ) : null;

    return (
        <Dialog open title={agent.name} lead={`by ${agent.maker}`} onClose={onClose} busy={busy} footer={footer}>
            <div data-testid="agent-dialog" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {!scope && (
                    <>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <AgentIcon agent={agent} size={44} />
                            <p style={{ ...muted, color: 'var(--text-primary)', fontSize: 14 }}>{agent.description}</p>
                        </div>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))', gap: 8 }}>
                            {(agent.capabilities || []).map((c) => (
                                <li key={c} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
                                    <Sparkles size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} /> {c}
                                </li>
                            ))}
                        </ul>

                        {agent.builtIn ? (
                            <p style={muted}>Built in for everyone. Chat with it from Agents in your sidebar, or mention <code>@{agent.mention}</code> in any conversation.</p>
                        ) : (
                            <>
                                <section aria-label="Connections" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <ScopeRow icon={User} title="Just for you" testId="agent-scope-personal" tone={own ? 'accent' : undefined}
                                        status={own
                                            ? `Your own ${agent.maker} key${own.model ? ` · ${own.model}` : ''}${agent.inUse === 'personal' ? ' · in use' : ' · not in use: personal connections are off here'}`
                                            : canConnectOwn ? `Use your own ${agent.maker} account. Only you can use it, and only your messages go through it.` : 'Your workspace admins turned off personal connections.'}>
                                        {own ? (
                                            <Btn size="sm" variant="ghost" icon={Trash2} disabled={busy} data-testid="agent-disconnect-own"
                                                onClick={() => run(() => disconnectOwn(workspaceId, agent.id), `Your ${agent.name} key was removed`)}>Disconnect</Btn>
                                        ) : canConnectOwn ? (
                                            <Btn size="sm" variant="primary" onClick={() => setScope('personal')} data-testid="agent-connect-own">Connect my own <ArrowRight size={13} /></Btn>
                                        ) : null}
                                    </ScopeRow>
                                    <ScopeRow icon={Users} title={`For everyone in ${workspaceName || 'this workspace'}`} testId="agent-scope-workspace" tone={agent.installedForWorkspace ? 'state-success' : undefined}
                                        status={agent.installedForWorkspace ? `Installed by an admin${agent.inUse === 'workspace' && agent.model ? ` · ${agent.model}` : ''}` : canManage ? 'Install it once with a key your organisation pays for.' : 'Not installed. A workspace admin can install it for everyone.'}>
                                        {canManage && (agent.installedForWorkspace ? (
                                            <Btn size="sm" variant="ghost" icon={Trash2} disabled={busy}
                                                onClick={() => run(() => uninstallAgent(workspaceId, agent.id), `${agent.name} was removed from the workspace`)}>Remove</Btn>
                                        ) : (
                                            <Btn size="sm" onClick={() => setScope('workspace')} data-testid="agent-install">Install for workspace</Btn>
                                        ))}
                                    </ScopeRow>
                                </section>
                                {inUseText && <p style={muted}><Check size={14} style={{ color: 'var(--state-success)', display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />{inUseText} Mention <code>@{agent.mention}</code> anywhere, or chat from Agents in your sidebar.</p>}
                                <div className="gl-wsp-alert" style={{ alignItems: 'flex-start', background: 'var(--bg-surface)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>
                                    <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                                    <span>Questions you ask {agent.name}, and the conversation they're about, are sent to {agent.maker}. Oruinwan AI keeps everything on Oruinwan's servers.</span>
                                </div>
                            </>
                        )}
                    </>
                )}

                {scope && (
                    <>
                        <div>
                            <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                                {scope === 'personal' ? `Connect your own ${agent.name}` : `Install ${agent.name} for everyone`}
                            </h3>
                            <p style={muted}>
                                {agent.maker} doesn't offer a “Sign in with {agent.maker}” for other apps, so {agent.name} connects with an API key from {scope === 'personal' ? 'your' : 'your organisation’s'} {agent.maker} account. Usage is billed to that account.
                                {scope === 'personal' ? ' Only you can use this key; nobody else in the workspace sees it.' : ' Everyone in the workspace can chat with it.'}
                            </p>
                        </div>
                        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                            <li>
                                <a href={agent.authorization?.keysUrl} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                                    Open the API keys page of your {agent.maker} account <ExternalLink size={12} style={{ display: 'inline', verticalAlign: '-1px' }} />
                                </a>{' '}(sign in or create an account; you may need to add billing).
                            </li>
                            <li>Create a key and copy it{agent.authorization?.keyHint ? ` (it starts with ${agent.authorization.keyHint.replace('…', '')})` : ''}.</li>
                            <li>Paste it below. Oruinwan checks it with {agent.maker}, then stores it encrypted.</li>
                        </ol>
                        <Field label={agent.authorization?.label || 'API key'} htmlFor="agent-key" error={error}>
                            <input id="agent-key" className="gl-input" type="password" autoComplete="off" placeholder={agent.authorization?.keyHint}
                                value={apiKey} onChange={(e) => { setApiKey(e.target.value); setError(''); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} data-testid="agent-key" />
                        </Field>
                        <details>
                            <summary style={{ fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>Choose a model (optional)</summary>
                            <input className="gl-input" style={{ marginTop: 8, fontFamily: 'monospace' }} placeholder={agent.model || 'Default model'} maxLength={80}
                                value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model" />
                        </details>
                    </>
                )}
            </div>
        </Dialog>
    );
}

/** A tool (GitHub, Jira) you can connect just for yourself, so what you do from chat runs as you. */
function ToolDialog({ tool, workspaceId, canManage, policy, onClose, onWorkspaceSetup }) {
    const { showToast } = useToast();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [token, setToken] = useState('');
    const [jira, setJira] = useState({ baseUrl: '', email: '', apiToken: '' });
    const own = tool.connectedForYou;
    const p = tool.personal;
    const canConnectOwn = Boolean(policy?.canConnectOwn);

    const act = async (fn, done) => {
        setBusy(true);
        setError('');
        try { await fn(); if (done) showToast(done, 'success'); } catch (err) { setError(errorMessage(err, 'That didn’t work')); } finally { setBusy(false); }
    };
    const authorize = () => act(() => startGithubAuthorize(workspaceId, window.location.href));
    const saveToken = () => {
        if (tool.id === 'github') {
            if (!token.trim()) { setError('Paste a GitHub personal access token'); return; }
            act(async () => { await connectOwnGithubToken(workspaceId, token.trim()); setToken(''); }, 'GitHub is connected for you');
        } else {
            act(async () => { await connectOwnJira(workspaceId, jira); setJira({ baseUrl: '', email: '', apiToken: '' }); }, 'Jira is connected for you');
        }
    };
    const who = own?.account?.login ? `${tool.id === 'github' ? '@' : ''}${own.account.login}` : own?.account?.name;

    return (
        <Dialog open title={tool.name} lead={`by ${tool.maker}`} onClose={onClose} busy={busy}
            footer={canManage ? <Btn variant="ghost" icon={Users} onClick={onWorkspaceSetup}>Workspace setup</Btn> : null}>
            <div data-testid="tool-dialog" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ ...muted, color: 'var(--text-primary)', fontSize: 14 }}>{tool.tagline}</p>
                <ScopeRow icon={User} title="Just for you" testId="tool-scope-personal" tone={own ? 'accent' : undefined}
                    status={own ? `Connected${who ? ` as ${who}` : ''} · ${own.method === 'oauth' ? 'signed in with GitHub' : 'access token'}` : p.actsAs}>
                    {own && <Btn size="sm" variant="ghost" icon={Trash2} disabled={busy} onClick={() => act(() => disconnectOwn(workspaceId, tool.id), `Your ${tool.name} connection was removed`)}>Disconnect</Btn>}
                </ScopeRow>
                {own && <p style={muted}>{p.actsAs}</p>}

                {!own && !canConnectOwn && <p style={muted}>Your workspace admins turned off personal connections.</p>}

                {!own && canConnectOwn && tool.id === 'github' && (
                    <>
                        {p.oauth ? (
                            <>
                                <Btn variant="primary" icon={Github} loading={busy} onClick={authorize} data-testid="github-authorize" style={{ alignSelf: 'flex-start' }}>Authorize with GitHub</Btn>
                                <p style={muted}>GitHub asks you to approve access to your repositories, then sends you back here.</p>
                            </>
                        ) : (
                            <p style={muted}>This server has no GitHub sign-in set up, so connect with a personal access token from your GitHub account.</p>
                        )}
                        <details open={!p.oauth}>
                            <summary style={{ fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>{p.oauth ? 'Or use a personal access token' : 'Personal access token'}</summary>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                                <p style={muted}>
                                    <a href={p.token.url} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                                        Create a token on GitHub <ExternalLink size={12} style={{ display: 'inline', verticalAlign: '-1px' }} />
                                    </a>{' '}with the <code>repo</code> scope (or a fine-grained token with Issues: read and write), then paste it here.
                                </p>
                                <Field label={p.token.label} htmlFor="tool-token">
                                    <input id="tool-token" className="gl-input" type="password" autoComplete="off" placeholder={p.token.hint} value={token}
                                        onChange={(e) => { setToken(e.target.value); setError(''); }} onKeyDown={(e) => { if (e.key === 'Enter') saveToken(); }} data-testid="tool-token" />
                                </Field>
                                <Btn icon={KeyRound} loading={busy} onClick={saveToken} style={{ alignSelf: 'flex-start' }}>Check and connect</Btn>
                            </div>
                        </details>
                    </>
                )}

                {!own && canConnectOwn && tool.id === 'jira' && (
                    <>
                        <p style={muted}>
                            Jira Cloud connects with your Atlassian email and an{' '}
                            <a href={p.token.url} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--accent)', fontWeight: 600 }}>API token from your Atlassian account <ExternalLink size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /></a>.
                        </p>
                        <Field label="Jira site" htmlFor="jira-site"><input id="jira-site" className="gl-input" placeholder="https://your-team.atlassian.net" value={jira.baseUrl} onChange={(e) => setJira({ ...jira, baseUrl: e.target.value })} /></Field>
                        <Field label="Atlassian email" htmlFor="jira-email"><input id="jira-email" className="gl-input" type="email" autoComplete="email" value={jira.email} onChange={(e) => setJira({ ...jira, email: e.target.value })} /></Field>
                        <Field label={p.token.label} htmlFor="jira-token"><input id="jira-token" className="gl-input" type="password" autoComplete="off" value={jira.apiToken} onChange={(e) => setJira({ ...jira, apiToken: e.target.value })} /></Field>
                        <Btn variant="primary" icon={KeyRound} loading={busy} onClick={saveToken} style={{ alignSelf: 'flex-start' }}>Check and connect</Btn>
                    </>
                )}
                {error && <div role="alert" className="gl-wsp-alert">{error}</div>}
                <p style={{ ...muted, fontSize: 12 }}>Your token is stored encrypted and used only for what you do. Nobody else in the workspace can see or use it.</p>
            </div>
        </Dialog>
    );
}

function ToolCard({ tool, onOpen, onSetup }) {
    const own = tool.connectedForYou;
    return (
        <article className={`gl-card${tool.personal ? ' gl-card--interactive' : ''}`} data-testid={`tool-card-${tool.id}`}
            style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, cursor: tool.personal ? 'pointer' : undefined }}
            {...(tool.personal ? { role: 'button', tabIndex: 0, onClick: () => onOpen(tool), onKeyDown: (e) => { if (e.key === 'Enter') onOpen(tool); } } : {})}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {TOOL_ICON[tool.id] ? <img src={TOOL_ICON[tool.id]} alt="" width={32} height={32} style={{ flexShrink: 0 }} /> : <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', background: 'var(--bg-active)', flexShrink: 0 }}><Puzzle size={15} /></span>}
                <div style={{ minWidth: 0 }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{tool.name}</h4>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{tool.maker}</p>
                </div>
            </div>
            <p style={{ ...muted, flex: 1 }}>{tool.tagline}</p>
            {own && <div><Chip tone="accent"><User size={11} /> Connected for you{own.account?.login ? ` · ${tool.id === 'github' ? '@' : ''}${own.account.login}` : ''}</Chip></div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {tool.personal && <button type="button" className="gl-btn gl-btn--sm" onClick={(e) => { e.stopPropagation(); onOpen(tool); }}>{own ? 'Manage' : 'Connect for me'}</button>}
                <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" onClick={(e) => { e.stopPropagation(); onSetup(); }}>Workspace setup</button>
            </div>
        </article>
    );
}

/** Agents & tools: installed agents, the agent directory, and tools (integrations). */
export default function AgentsPage() {
    const { workspaceId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') === 'directory' ? 'directory' : 'installed';
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(null);
    const [openTool, setOpenTool] = useState(null);
    const { agents, tools, canManage, policy, loading, error, reload } = useAgents(workspaceId);
    const { activeWorkspace } = useWorkspace();

    // Back from GitHub's sign-in: say how it went, then tidy the address.
    useEffect(() => {
        const connected = params.get('connected');
        const failed = params.get('connectError');
        if (!connected && !failed) return;
        if (connected) showToast(`${connected === 'github' ? 'GitHub' : connected} is connected for you`, 'success');
        if (failed) showToast(failed, 'error');
        const next = new URLSearchParams(params);
        next.delete('connected');
        next.delete('connectError');
        setParams(next, { replace: true });
        reload();
    }, [params, setParams, showToast, reload]);

    const q = query.trim().toLowerCase();
    const match = (a) => !q || `${a.name} ${a.maker} ${a.tagline}`.toLowerCase().includes(q);
    const installed = useMemo(() => agents.filter((a) => a.installed), [agents]);
    const shownAgents = (tab === 'installed' ? installed : agents).filter(match);
    const shownTools = tab === 'directory' ? tools.filter(match) : tools.filter((t) => t.connectedForYou && match(t));

    const chat = async (agent) => {
        try {
            const dmId = await openAgentDm(workspaceId, agent.id);
            navigate(`/workspace/${workspaceId}/home/dm/${dmId}`);
        } catch (err) {
            showToast(err.response?.data?.message || `Couldn't open ${agent.name}`, 'error');
        }
    };
    const workspaceSetup = () => navigate(`/workspace/${workspaceId}/apps`);

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow={activeWorkspace?.name ? `${activeWorkspace.name} · Agents & tools` : 'Agents & tools'}
                    title="Agents"
                    icon={Bot}
                    lead={policy?.canConnectOwn
                        ? 'AI teammates you can chat with or @mention. Use the ones your workspace installed, or connect your own account just for you.'
                        : 'AI teammates you can chat with or @mention. Install one, then find it under Agents in your sidebar.'}
                    actions={(
                        <>
                            {/* Phones have no side panel: reach Workflows and Apps from here. */}
                            <Btn variant="ghost" icon={Workflow} className="agents-phone-only" onClick={() => navigate(`/workspace/${workspaceId}/automations`)}>Workflows</Btn>
                            <Btn variant="ghost" icon={Puzzle} className="agents-phone-only" onClick={() => navigate(`/workspace/${workspaceId}/apps`)}>Apps</Btn>
                            {tab === 'installed' && installed.length > 1 && <Btn variant="primary" icon={Plus} onClick={() => setParams({ tab: 'directory' })}>Add an agent</Btn>}
                        </>
                    )}
                />
            )}
        >
            <Toolbar>
                <FilterTabs value={tab} onChange={(id) => setParams(id === 'directory' ? { tab: 'directory' } : {})} label="Agents" options={[
                    { value: 'installed', label: 'Yours', count: installed.length },
                    { value: 'directory', label: 'Directory', count: agents.length + tools.length },
                ]} />
                <SearchBox value={query} onChange={setQuery} placeholder="Search agents and tools" label="Search agents and tools" />
            </Toolbar>

            {loading && <LoadingState label="Loading agents…" />}
            {error && <ErrorState message={error} onRetry={reload} />}

            {!loading && tab === 'installed' && installed.length <= 1 && !q && (
                <div className="gl-card" style={{ padding: 20, marginBottom: 18, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex' }}>
                        {agents.filter((a) => !a.builtIn).map((a, i) => <span key={a.id} style={{ marginLeft: i ? -8 : 0 }}><AgentIcon agent={a} size={34} /></span>)}
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <strong style={{ color: 'var(--text-primary)' }}>Add Claude, ChatGPT, Gemini or Grok</strong>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                            Oruinwan AI is built in. {policy?.canConnectOwn ? 'Connect your own account for any of these, just for you.' : 'Browse the directory to see what your workspace can add.'}
                        </p>
                    </div>
                    <button type="button" className="gl-btn gl-btn--primary" onClick={() => setParams({ tab: 'directory' })}>Browse agents</button>
                </div>
            )}

            {shownAgents.length > 0 && (
                <section aria-label="Agents">
                    {(tab === 'directory' || shownTools.length > 0) && <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 12px' }}>Agents</h3>}
                    <div style={grid}>
                        {shownAgents.map((a) => <AgentCard key={a.id} agent={a} onOpen={setOpen} onChat={chat} />)}
                    </div>
                </section>
            )}

            {shownTools.length > 0 && (
                <section aria-label="Tools" style={{ marginTop: 28 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Tools</h3>
                    <p style={{ ...muted, margin: '0 0 12px' }}>Connect GitHub or Jira just for you, so what you do from chat runs as you. Admins set up the workspace-wide connection in Apps.</p>
                    <div style={grid}>
                        {shownTools.map((t) => <ToolCard key={t.id} tool={t} onOpen={setOpenTool} onSetup={workspaceSetup} />)}
                    </div>
                </section>
            )}

            {!loading && q && !shownAgents.length && !shownTools.length && (
                <EmptyState icon={Search} title="Nothing matches" text={`No agent or tool is called “${query}”.`} />
            )}

            {open && (
                <AgentDialog agent={agents.find((a) => a.id === open.id) || open} workspaceId={workspaceId} workspaceName={activeWorkspace?.name}
                    canManage={canManage} policy={policy} onClose={() => setOpen(null)} onChat={(a) => { setOpen(null); chat(a); }} />
            )}
            {openTool && (
                <ToolDialog tool={tools.find((t) => t.id === openTool.id) || openTool} workspaceId={workspaceId} canManage={canManage} policy={policy}
                    onClose={() => setOpenTool(null)} onWorkspaceSetup={() => { setOpenTool(null); workspaceSetup(); }} />
            )}
            <style>{'.agents-phone-only{display:none!important}@media (max-width:767px){.agents-phone-only{display:inline-flex!important}}'}</style>
        </DashPage>
    );
}
