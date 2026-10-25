import { useState } from 'react';
import { Link2, Send } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { Field } from '../../ui/Controls.jsx';
import { toast } from '../../lib/bus.js';
import { shareLink } from '../../native/index.js';
import { usePlanBlock } from '../plan/plan.js';
import { blockedNote } from '../plan/planText.js';
import { PlanLimitNote } from '../plan/PlanLimitNote.jsx';

/**
 * Who may invite people to a workspace — the server's rule: owners and admins always;
 * members when the workspace lets members invite (or on the unlimited plan).
 */
export function canInvite(workspace) {
  if (!workspace) return false;
  if (['owner', 'admin'].includes(workspace.role) || workspace.isOwner) return true;
  return workspace.plan === 'enterprise' || workspace.settings?.membersMayInvite === true;
}

/** "a@x.com, b@y.com\nc@z.com" → unique addresses. */
export function parseEmails(text) {
  return [...new Set(String(text || '').split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

/** Invite people to the current workspace: share a join link, or send email invitations. */
export function InviteSheet({ open, onClose, workspace }) {
  const mode = useSession((s) => s.mode);
  const { plan, blocked } = usePlanBlock(open ? workspace?.id : null, 'members.perWorkspace');
  const [emails, setEmails] = useState('');
  const [busy, setBusy] = useState(null);

  const shareInviteLink = async () => {
    setBusy('link');
    try {
      const url = await api().teamInviteLink(workspace.id);
      if (!url) return toast("Couldn't create an invite link", 'danger');
      const result = await shareLink({ title: `Join ${workspace.name} on Oruinwan`, text: `Join ${workspace.name} on Oruinwan`, url });
      if (result === 'copied') toast('Invite link copied');
    } catch (err) {
      toast(err.message || "Couldn't create an invite link", 'danger');
    } finally {
      setBusy(null);
    }
  };

  const sendEmails = async () => {
    const list = parseEmails(emails);
    const bad = list.filter((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    if (bad.length) return toast(`Check ${bad[0]}`, 'danger');
    setBusy('email');
    try {
      await api().inviteByEmail(workspace.id, list);
      toast(list.length === 1 ? `Invitation sent to ${list[0]}` : `${list.length} invitations sent`, 'success');
      setEmails('');
      onClose();
    } catch (err) {
      toast(err.message || 'The invitations could not be sent', 'danger');
    } finally {
      setBusy(null);
    }
  };

  if (!workspace) return null;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Invite people to ${workspace.name}`}
      footer={
        <Button block icon={Send} loading={busy === 'email'} disabled={blocked || mode !== 'live' || !parseEmails(emails).length} onClick={sendEmails}>
          Send invitations
        </Button>
      }
    >
      <div className="px-5 pb-4">
        {blocked && <PlanLimitNote className="mb-3">{blockedNote(plan, 'members.perWorkspace')}</PlanLimitNote>}
        <Button block variant="secondary" icon={Link2} loading={busy === 'link'} disabled={blocked || mode !== 'live'} onClick={shareInviteLink}>
          Share an invite link
        </Button>
        <p className="mt-1.5 text-center text-xs text-text-3">Anyone with the link can join for 7 days.</p>
        <div className="mt-5">
          <Field
            label="Or invite by email"
            multiline
            rows={3}
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="sarah@example.com, alex@design.co"
            autoCapitalize="none"
            inputMode="email"
            hint="Separate emails with commas or new lines. They join #general and the other default channels."
          />
        </div>
      </div>
    </Sheet>
  );
}
