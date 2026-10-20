import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, Hash, Rocket, Share2, X } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Field } from '../../ui/Controls.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { toast } from '../../lib/bus.js';
import { startingChannels } from '../../lib/channelName.js';
import { copyText, shareLink, tap } from '../../native/index.js';
import { useNav } from '../../app/nav.js';
import { WorkspaceTile } from './WorkspaceTile.jsx';

const COLORS = ['#b8956a', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#5c5852', '#14b8a6', '#f43f5e'];
const PROJECT_IDEAS = ['Website', 'Product launch', 'Marketing', 'Hiring', 'Customer support'];
const CHANNEL_NOTES = { general: 'Announcements and work-wide conversation', random: 'Water-cooler talk' };

/**
 * Create a workspace on the phone: 1) name your team, 2) what you're working on (becomes a
 * channel), 3) invite teammates with a link (system share sheet) or by email. The workspace is
 * created when step 2 ends, so step 3 shares a real link. Same steps as the web wizard.
 */
export function CreateWorkspaceFlow() {
  const close = useSession((s) => s.closeCreateWorkspace);
  const finish = useSession((s) => s.finishCreateWorkspace);
  const mode = useSession((s) => s.mode);
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [project, setProject] = useState('');
  const [emails, setEmails] = useState('');
  const [created, setCreated] = useState(null);
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Android back: a step back, or close before anything exists.
  useEffect(() => {
    const { pushOverlay, removeOverlay } = useNav.getState();
    pushOverlay('create-workspace', () => {
      if (busy) return;
      if (step === 2) setStep(1);
      else if (created) finish(created);
      else close();
    });
    return () => removeOverlay('create-workspace');
  }, [step, busy, created, close, finish]);

  useEffect(() => {
    if (step !== 3 || !created || link !== null) return;
    api()
      .teamInviteLink(created.id)
      .then((l) => setLink(l || ''))
      .catch(() => setLink(''));
  }, [step, created, link]);

  const create = async (withProject) => {
    setBusy(true);
    setError('');
    try {
      const ws = await api().createWorkspace({ name: name.trim(), color, icon: 'rocket', project: withProject.trim() || undefined });
      setCreated(ws);
      tap('medium');
      setStep(3);
    } catch (err) {
      setError(err.message || 'Could not create the workspace.');
    } finally {
      setBusy(false);
    }
  };

  const done = async () => {
    const list = [...new Set(emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean))];
    if (list.length) {
      setBusy(true);
      try {
        await api().inviteByEmail(created.id, list);
        toast(`Invitation${list.length === 1 ? '' : 's'} sent`, 'success');
      } catch (err) {
        toast(err.message || 'The invitations could not be sent', 'danger');
      } finally {
        setBusy(false);
      }
    }
    finish(created);
  };

  const next = (e) => {
    e?.preventDefault();
    setError('');
    if (step === 1) {
      if (!name.trim()) return setError('Give your workspace a name.');
      setStep(2);
    } else if (step === 2) create(project);
    else done();
  };

  const share = async () => {
    const result = await shareLink({ title: `Join ${created.name} on Oruinwan`, text: `Join ${created.name} on Oruinwan`, url: link });
    if (result === 'copied') toast('Link copied');
  };

  const channels = startingChannels(project);

  return (
    <div className="flex h-full flex-col bg-bg pt-safe" role="dialog" aria-modal="true" aria-label="Create a workspace">
      <div className="flex h-14 shrink-0 items-center gap-1 px-2">
        {step === 2 && !busy ? (
          <IconButton icon={ArrowLeft} label="Back" onClick={() => setStep(1)} />
        ) : (
          <IconButton icon={X} label={created ? 'Close' : 'Cancel'} onClick={() => (created ? finish(created) : close())} disabled={busy} />
        )}
        <div className="flex flex-1 justify-center gap-1.5" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={cx('h-1.5 rounded-full transition-all', n === step ? 'w-6 bg-accent' : n < step ? 'w-1.5 bg-accent/60' : 'w-1.5 bg-line')} />
          ))}
        </div>
        <span className="w-10" />
      </div>

      <form onSubmit={next} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto px-5 pb-6">
          {step === 1 && (
            <>
              <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-tight">What's the name of your team or company?</h1>
              <p className="mt-2 text-[15px] text-text-2">This is your workspace's name. Pick something your team will recognise.</p>
              <div className="mt-6">
                <Field
                  label="Workspace name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  placeholder="e.g. Acme Corp, Design Team"
                  maxLength={80}
                  autoFocus
                  enterKeyHint="next"
                />
              </div>
              <p className="mb-2 mt-6 text-[13px] font-medium text-text-2">Colour</p>
              <div className="grid grid-cols-5 gap-2.5" role="radiogroup" aria-label="Colour">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={`Colour ${c}`}
                    onClick={() => setColor(c)}
                    className="pressable grid aspect-square place-items-center rounded-xl"
                    style={{ background: c, boxShadow: color === c ? '0 0 0 2px rgb(var(--c-bg)), 0 0 0 4px rgb(var(--c-accent))' : undefined }}
                  >
                    {color === c && <Check size={18} strokeWidth={3} color="#fff" />}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3 rounded-card border border-line-soft bg-surface px-4 py-3">
                <WorkspaceTile workspace={{ name: name.trim() || 'W', color }} size={40} />
                <span className="min-w-0 truncate text-[16px] font-semibold">{name.trim() || 'Your workspace'}</span>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-tight">What's your team working on right now?</h1>
              <p className="mt-2 text-[15px] text-text-2">A project, a campaign, an event or a deal. We'll make a channel for it.</p>
              <div className="mt-6">
                <Field label="Project" value={project} onChange={(e) => setProject(e.target.value)} placeholder="e.g. Website redesign" maxLength={80} autoFocus enterKeyHint="go" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {PROJECT_IDEAS.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => setProject(idea)}
                    className={cx('pressable h-9 rounded-full border px-3.5 text-[14px] font-medium', project === idea ? 'border-accent bg-accent/15 text-accent-ink' : 'border-line bg-surface text-text-2')}
                  >
                    {idea}
                  </button>
                ))}
              </div>
              <p className="mb-2 mt-7 text-[13px] font-medium text-text-2">Your channels</p>
              <ul className="overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft" data-testid="channel-preview">
                {channels.map((c) => (
                  <li key={c} className="flex items-center gap-3 px-4 py-3">
                    <Icon as={Hash} size="sm" className="text-text-3" />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium">{c}</span>
                      <span className="block truncate text-[13px] text-text-2">{CHANNEL_NOTES[c] || 'Everything about this project'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {step === 3 && created && (
            <>
              <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-tight">Who else is on your team?</h1>
              <p className="mt-2 text-[15px] text-text-2">{created.name} is ready. Bring your teammates in.</p>

              {mode === 'live' && (
                <div className="mt-6 rounded-card border border-line-soft bg-surface p-4">
                  <p className="text-[15px] font-semibold">Share an invite link</p>
                  <p className="mt-1 text-[13px] text-text-2">Anyone with the link can join for the next 7 days.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <Button variant="secondary" icon={Share2} onClick={share} disabled={!link}>
                      Share link
                    </Button>
                    <Button
                      variant="secondary"
                      icon={Copy}
                      disabled={!link}
                      onClick={async () => toast((await copyText(link)) ? 'Link copied' : "Couldn't copy the link")}
                    >
                      Copy
                    </Button>
                  </div>
                  {link === '' && <p className="mt-2 text-[13px] text-danger">The link couldn't be created. You can invite people later from Workspace details.</p>}
                </div>
              )}

              <div className="mt-5">
                <Field
                  label={mode === 'live' ? 'Or invite by email' : 'Invite by email'}
                  multiline
                  rows={3}
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder="sarah@example.com, alex@design.co"
                  autoCapitalize="none"
                  inputMode="email"
                  hint="Separate emails with commas or new lines."
                />
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        <div className="mx-auto w-full max-w-lg shrink-0 space-y-2 border-t border-line-soft bg-bg px-5 pb-safe pt-3">
          <Button type="submit" block size="lg" loading={busy} icon={step === 2 ? Rocket : undefined} iconRight={step === 1 ? ArrowRight : undefined} data-testid="wizard-next">
            {step === 1 ? 'Next' : step === 2 ? 'Create workspace' : emails.trim() ? 'Send invites and open' : 'Open workspace'}
          </Button>
          {step === 2 && (
            <Button
              variant="ghost"
              block
              disabled={busy}
              onClick={() => {
                setProject('');
                create('');
              }}
            >
              Skip
            </Button>
          )}
          {step === 3 && !emails.trim() && (
            <Button variant="ghost" block disabled={busy} onClick={() => finish(created)}>
              Skip for now
            </Button>
          )}
          <span className="block h-2" />
        </div>
      </form>
    </div>
  );
}
