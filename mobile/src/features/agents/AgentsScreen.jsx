// Agents: every agent with how it reaches you (built in, installed for the workspace, or your own
// key), and connecting or removing your own. AI companies only offer API keys to other apps, so
// connecting is a pasted key that the server checks with the provider before saving it.
// Tools that sign in with the provider (GitHub, Jira) are connected in the web app.
import { useState } from 'react';
import { Bot, Check, ExternalLink, KeyRound, MessageSquare, Plug, Trash2, User, Users } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { invalidate, useQuery } from '../../data/query.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button } from '../../ui/Button.jsx';
import { Field } from '../../ui/Controls.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Sheet } from '../../ui/Overlay.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { toast } from '../../lib/bus.js';
import { openExternal } from '../../native/index.js';
import { useWebUrl } from '../../data/live/webUrl.js';
import { openConversation } from '../chats/chatsUi.js';

function statusOf(a) {
  if (a.builtIn) return { text: 'Built in', tone: 'success' };
  if (a.inUse === 'personal') return { text: 'Connected for you', tone: 'accent' };
  if (a.installedForWorkspace) return { text: 'Installed for workspace', tone: 'success' };
  if (a.connectedForYou) return { text: 'Yours · off here', tone: 'neutral' };
  return { text: 'Connect', tone: 'neutral' };
}

const PILL = {
  success: 'bg-success/12 text-success',
  accent: 'bg-accent/15 text-accent-ink',
  neutral: 'bg-surface-3 text-text-2',
};

function Pill({ tone, children }) {
  return <span className={cx('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium', PILL[tone])}>{children}</span>;
}

function refresh(ws) {
  invalidate(`agentDirectory:${ws}`);
  invalidate('agents');
  invalidate('assistants');
}

/** One agent: how it reaches you, and your own key. */
function AgentSheet({ agent, ws, policy, onClose }) {
  const [connecting, setConnecting] = useState(false);
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const own = agent.connectedForYou;

  const connect = async () => {
    if (!key.trim()) { setError(`Paste your ${agent.authorization?.label || 'API key'}`); return; }
    setBusy(true);
    setError('');
    try {
      await api().connectOwnAgent(ws, agent.id, key.trim());
      toast(`${agent.name} is connected for you`, 'success');
      refresh(ws);
      onClose();
    } catch (err) {
      setError(err.message || `Couldn't connect ${agent.name}`);
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    setBusy(true);
    try {
      await api().disconnectOwn(ws, agent.id);
      toast(`Your ${agent.name} key was removed`, 'success');
      refresh(ws);
      onClose();
    } catch (err) {
      toast(err.message || 'That didn’t work', 'danger');
    } finally {
      setBusy(false);
    }
  };
  const chat = async () => {
    try {
      const id = await api().openAgentDm(ws, agent.id);
      invalidate('dms');
      onClose();
      openConversation('dm', id);
    } catch (err) {
      toast(err.message || `Couldn't open ${agent.name}`, 'danger');
    }
  };

  return (
    <div className="px-5 pb-5" data-testid="agent-sheet">
      <div className="flex items-center gap-3.5">
        <img src={agent.icon} alt="" className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{agent.name}</h2>
          <p className="text-[13px] text-text-2">by {agent.maker}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-text-2">{agent.tagline}</p>

      {!connecting && (
        <>
          <div className="mt-4 overflow-hidden rounded-card border border-line-soft divide-y divide-line-soft">
            <Row icon={User} tile={own ? 'accent' : 'neutral'} title="Just for you" multiline
              subtitle={own ? `Your own ${agent.maker} key${own.model ? ` · ${own.model}` : ''}${agent.inUse === 'personal' ? ' · in use' : ' · not in use here'}`
                : policy.canConnectOwn ? 'Not connected. Only you could use it.' : 'Your workspace admins turned off personal connections.'} />
            <Row icon={Users} tile={agent.installedForWorkspace ? 'success' : 'neutral'} title="For the workspace" multiline
              subtitle={agent.installedForWorkspace ? 'Installed by an admin for everyone' : 'Not installed. An admin can install it in the web app.'} />
          </div>
          {agent.inUse && (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-text-2">
              <Icon as={Check} size="sm" className="text-success" />
              {agent.inUse === 'personal' ? 'Answers you with your own key.' : 'Answers you with the workspace’s key.'}
            </p>
          )}
          <div className="mt-4 flex flex-col gap-2">
            {agent.installed && <Button block icon={MessageSquare} onClick={chat}>Chat with {agent.name}</Button>}
            {own ? (
              <Button block variant="secondary" icon={Trash2} loading={busy} onClick={disconnect}>Disconnect my key</Button>
            ) : policy.canConnectOwn ? (
              <Button block variant={agent.installed ? 'secondary' : 'primary'} icon={KeyRound} onClick={() => setConnecting(true)} data-testid="agent-connect-own">Connect my own</Button>
            ) : null}
          </div>
        </>
      )}

      {connecting && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-[13px] leading-relaxed text-text-2">
            {agent.maker} doesn’t offer a sign-in for other apps, so {agent.name} connects with an API key from your {agent.maker} account. Usage is billed to that account, and only you can use it.
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-text-2">
            <li>
              <button type="button" className="font-semibold text-accent-ink underline-offset-2 active:underline" onClick={() => openExternal(agent.authorization?.keysUrl)}>
                Open your {agent.maker} API keys page
              </button>{' '}and create a key.
            </li>
            <li>Copy it and paste it here. Oruinwan checks it, then stores it encrypted.</li>
          </ol>
          <Field label={agent.authorization?.label || 'API key'} type="password" autoComplete="off" placeholder={agent.authorization?.keyHint}
            value={key} onChange={(e) => { setKey(e.target.value); setError(''); }} error={error} data-testid="agent-key" />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => { setConnecting(false); setError(''); }}>Back</Button>
            <Button className="flex-1" icon={KeyRound} loading={busy} onClick={connect} data-testid="agent-authorize">Check and connect</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentsScreen() {
  const ws = useSession((s) => s.workspaceId);
  const mode = useSession((s) => s.mode);
  const server = useSession((s) => s.server);
  const { data, loading } = useQuery(ws && `agentDirectory:${ws}`, () => api().agentDirectory?.(ws));
  const [active, setActive] = useState(null);
  const agents = data?.agents || [];
  const tools = data?.tools || [];
  const policy = data?.policy || { canConnectOwn: false };
  const current = active && agents.find((a) => a.id === active);
  const webUrl = useWebUrl(server);
  const webPage = mode === 'live' && webUrl ? `${webUrl}/workspace/${ws}/agents?tab=directory` : null;

  return (
    <Screen>
      <Header title="Agents" subtitle={policy.canConnectOwn ? 'Use the workspace’s, or connect your own' : undefined} />
      <Body onRefresh={() => refresh(ws)}>
        {loading ? (
          <SkeletonRows />
        ) : !agents.length ? (
          <EmptyState icon={Bot} title="No agents here" body="Oruinwan AI lives in the AI tab." />
        ) : (
          <>
            <Section title="Agents">
              <RowGroup footer={policy.canConnectOwn ? 'Your own key is used only for your messages. Nobody else in the workspace can see or use it.' : 'Your workspace admins decide which agents everyone can use.'}>
                {agents.map((a) => {
                  const s = statusOf(a);
                  return (
                    <Row key={a.id} leading={<img src={a.icon} alt="" className="h-10 w-10 shrink-0 rounded-xl" />}
                      title={a.name} subtitle={a.maker} trailing={<Pill tone={s.tone}>{s.text}</Pill>}
                      onClick={() => setActive(a.id)} />
                  );
                })}
              </RowGroup>
            </Section>
            {tools.length > 0 && (
              <Section title="Tools">
                <RowGroup footer="GitHub and Jira sign in with the provider, so you connect them in the web app.">
                  {tools.map((t) => (
                    <Row key={t.id} icon={Plug} title={t.name} multiline
                      subtitle={t.connectedForYou ? `Connected for you${t.connectedForYou.login ? ` · ${t.connectedForYou.login}` : ''}` : t.actsAs}
                      trailing={webPage ? <Icon as={ExternalLink} size="sm" className="text-text-3" /> : null}
                      onClick={webPage ? () => openExternal(webPage) : undefined} />
                  ))}
                </RowGroup>
              </Section>
            )}
          </>
        )}
      </Body>
      <Sheet open={Boolean(current)} onClose={() => setActive(null)}>
        {current && <AgentSheet agent={current} ws={ws} policy={policy} onClose={() => setActive(null)} />}
      </Sheet>
    </Screen>
  );
}
