// Joining a workspace from an invitation: the link someone was sent (opened on the phone, or
// pasted). Shows what the invitation is for, then joins it, as the web's /join-workspace does
// (GET /workspaces/invite/:token, POST /workspaces/join).
import { useEffect, useState } from 'react';
import { ArrowRight, Link2, Shield, TriangleAlert, Users, X } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { useNav } from '../../app/nav.js';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Field } from '../../ui/Controls.jsx';
import { Sheet } from '../../ui/Overlay.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Spinner } from '../../ui/Feedback.jsx';
import { toast } from '../../lib/bus.js';
import { deviceNoun, tap } from '../../native/index.js';
import { parseInvite } from '../../lib/invite.js';
import { WorkspaceTile } from './WorkspaceTile.jsx';

function Fact({ icon, label, value }) {
  return (
    <div className="flex-1 rounded-xl border border-line-soft bg-surface px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-text-3 uppercase">
        <Icon as={icon} size={12} /> {label}
      </p>
      <p className="mt-1 text-[15px] font-medium capitalize">{value}</p>
    </div>
  );
}

export function JoinWorkspaceFlow() {
  const token = useSession((s) => s.joinToken);
  const close = useSession((s) => s.closeInvite);
  const finish = useSession((s) => s.finishInvite);
  const user = useSession((s) => s.user);
  const workspaces = useSession((s) => s.workspaces);
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const { pushOverlay, removeOverlay } = useNav.getState();
    pushOverlay('join-workspace', () => !joining && close());
    return () => removeOverlay('join-workspace');
  }, [joining, close]);

  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    setError('');
    api()
      .inviteDetails(token)
      .then((d) => !cancelled && setDetails(d))
      .catch((err) => !cancelled && setError(err.message || "This invitation couldn't be loaded."));
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Only used after the server says "already a member", to open it.
  const already = details && workspaces.find((w) => w.name === details.name);

  const join = async () => {
    setJoining(true);
    try {
      const ws = await api().joinWithInvite(token);
      tap('medium');
      toast(`You joined ${ws.name || details.name}`, 'success');
      await finish(ws);
    } catch (err) {
      if (err.code === 'ALREADY_MEMBER') {
        toast(`You're already in ${details.name}`);
        await finish(already || null);
        return;
      }
      setError(err.message || "You couldn't be added to this workspace.");
      setJoining(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg pt-safe" role="dialog" aria-modal="true" aria-label="Join a workspace">
      <div className="flex h-14 shrink-0 items-center px-2">
        <IconButton icon={X} label="Cancel" onClick={close} disabled={joining} />
      </div>
      <div className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-safe">
        {error ? (
          <div className="flex flex-1 flex-col pt-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-danger/25 bg-danger/12 text-danger">
              <Icon as={TriangleAlert} size="lg" />
            </span>
            <h1 className="mt-5 text-[26px] font-bold leading-tight tracking-tight">This invitation can't be used</h1>
            <p className="mt-2 text-[15px] text-text-2">{error}</p>
            <p className="mt-3 text-[13px] text-text-3">Invitation links can expire or be used up. Ask the person who invited you for a new one.</p>
            <div className="mt-auto space-y-2.5 pt-8 pb-6">
              <Button block onClick={close}>
                Back to your workspaces
              </Button>
            </div>
          </div>
        ) : !details ? (
          <div className="grid flex-1 place-items-center pb-20 text-text-2" aria-busy="true" aria-label="Checking your invitation">
            <span className="flex flex-col items-center gap-3 text-sm">
              <Spinner />
              Checking your invitation…
            </span>
          </div>
        ) : (
          <div className="flex flex-1 flex-col pt-2">
            <WorkspaceTile workspace={details} size={64} />
            <p className="mt-5 text-[12px] font-semibold tracking-wider text-accent-ink uppercase">Workspace invitation</p>
            <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight">Join {details.name}</h1>
            <p className="mt-2 text-[15px] text-text-2">
              {details.invitedBy ? (
                <>
                  <strong className="font-semibold text-text">{details.invitedBy}</strong> invited you to join as {details.role === 'admin' ? 'an' : 'a'}{' '}
                  {details.role}.
                </>
              ) : (
                `You're invited to join as ${details.role === 'admin' ? 'an' : 'a'} ${details.role}.`
              )}
            </p>
            {details.description && (
              <p className="mt-4 rounded-xl border border-line-soft bg-surface px-3.5 py-3 text-[14px] text-text-2">{details.description}</p>
            )}
            <div className="mt-5 flex gap-2.5">
              <Fact icon={Users} label="Members" value={details.memberCount ?? '—'} />
              <Fact icon={Shield} label="Your role" value={details.role} />
            </div>
            <div className="mt-auto pt-8 pb-6">
              <Button block size="lg" iconRight={ArrowRight} loading={joining} onClick={join} data-testid="join-workspace">
                Join {details.name}
              </Button>
              <p className="mt-3 text-center text-[13px] text-text-3">Joining as {user?.email || user?.name}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** "Join with a link": paste the invitation link (or just its code) someone sent you. */
export function JoinWithLinkSheet({ open, onClose }) {
  const openInvite = useSession((s) => s.openInvite);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const submit = (e) => {
    e?.preventDefault();
    const v = value.trim();
    if (!v) return setError('Paste the invitation link you were sent.');
    if (!parseInvite(v)) return setError("That doesn't look like an invitation link. It starts with https:// and has /join-workspace in it.");
    setValue('');
    setError('');
    onClose();
    openInvite(v);
    return undefined;
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Join with a link"
      footer={
        <Button block onClick={submit} disabled={!value.trim()} data-testid="join-link-continue">
          Continue
        </Button>
      }
    >
      <form onSubmit={submit} className="px-5 pb-4">
        <p className="mb-4 text-[14px] text-text-2">Paste the invitation link from your email or message. Opening the link on this {deviceNoun} works too.</p>
        <Field
          label="Invitation link or code"
          icon={Link2}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError('');
          }}
          error={error}
          placeholder="https://…/join-workspace?token=…"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          data-testid="join-link-input"
        />
      </form>
    </Sheet>
  );
}
