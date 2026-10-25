// Add people to the call you're in: pick from the workspace; their phones ring and they can join.
import { useMemo, useState } from 'react';
import { Check, UserPlus } from 'lucide-react';
import { useMembers } from '../../data/hooks.js';
import { useSession } from '../../data/session.js';
import { Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { SearchField } from '../../ui/Controls.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { EmptyState } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { toast } from '../../lib/bus.js';
import { searchPeople } from '../../lib/peopleSearch.js';
import { inviteToCall, useHuddle } from './huddle.js';

export function AddPeopleSheet({ open, onClose }) {
  const { data: members } = useMembers();
  const me = useSession((s) => s.user?.id);
  const inCall = useHuddle((s) => s.participants);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const here = useMemo(() => new Set(inCall.map((p) => String(p.userId))), [inCall]);
  const list = useMemo(() => searchPeople((members || []).filter((u) => u.id !== me && !u.bot && !u.deactivated && !here.has(String(u.id))), q), [members, me, here, q]);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const add = async () => {
    setBusy(true);
    try {
      const r = await inviteToCall(picked);
      toast(r.invited === 1 ? 'Calling them now' : `Calling ${r.invited} people now`, 'success');
      setPicked([]);
      setQ('');
      onClose();
    } catch (err) {
      toast(err.message || 'Could not add them', 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add people to the call"
      full
      footer={
        <Button block icon={UserPlus} disabled={!picked.length} loading={busy} onClick={add} data-testid="call-add-confirm">
          {picked.length ? `Add ${picked.length} and ring` : 'Pick people to add'}
        </Button>
      }
    >
      <div className="px-4 pb-2">
        <SearchField value={q} onChange={setQ} placeholder="Search people" />
      </div>
      {list.length ? (
        <ul className="px-2 pb-2">
          {list.map((u) => {
            const on = picked.includes(u.id);
            return (
              <li key={u.id}>
                <button type="button" onClick={() => toggle(u.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left active:bg-surface-2" aria-pressed={on}>
                  <Avatar name={u.name} src={u.avatarUrl} size="sm" presence={u.presence} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{u.name}</span>
                    <span className="block truncate text-[12px] text-text-2">{u.title || u.email}</span>
                  </span>
                  <span className={cx('grid h-6 w-6 place-items-center rounded-full border', on ? 'border-accent bg-gold text-on-accent' : 'border-line-strong')}>
                    {on && <Icon as={Check} size={14} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={UserPlus} title={q ? 'No one matches' : 'Everyone is already here'} body="Only people in this workspace can be added." />
      )}
    </Sheet>
  );
}
