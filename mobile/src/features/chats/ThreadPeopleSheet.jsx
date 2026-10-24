import { useState } from 'react';
import { Check, UserMinus, UserPlus } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { useMembers } from '../../data/hooks.js';
import { invalidate, useQuery } from '../../data/query.js';
import { Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { toast } from '../../lib/bus.js';

/**
 * Who follows a thread (the web's People dialog): anyone can add people from the conversation
 * (they're notified), channel admins remove followers, everyone can leave.
 */
export function ThreadPeopleSheet({ open, onClose, messageId, onChanged }) {
  const me = useSession((s) => s.user?.id);
  const { data: members } = useMembers();
  const key = open && api().threadFollowers && `threadpeople:${messageId}`;
  const { data, loading } = useQuery(key, () => api().threadFollowers(messageId));
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  const followerIds = new Set((data?.followers || []).map((f) => f.id));
  const candidates = (members || []).filter((m) => !followerIds.has(m.id));

  const close = () => {
    setAdding(false);
    setPicked([]);
    onClose();
  };

  const add = async () => {
    setBusy(true);
    try {
      const r = await api().addThreadFollowers(messageId, picked);
      toast(r.added.length ? `Added ${r.added.length} ${r.added.length === 1 ? 'person' : 'people'}` : 'Nobody new was added', 'success');
      if (r.skipped.length) toast("Some people can't see this conversation, so they weren't added");
      setAdding(false);
      setPicked([]);
      invalidate(`threadpeople:${messageId}`);
      onChanged?.();
    } catch (err) {
      toast(err.message || 'Could not add people', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (f) => {
    setBusy(true);
    try {
      await api().removeThreadFollower(messageId, f.id);
      toast(f.id === me ? 'You left this thread' : `${f.username || 'They'} no longer follow this thread`);
      invalidate(`threadpeople:${messageId}`);
      onChanged?.();
    } catch (err) {
      toast(err.message || 'Could not remove them', 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={adding ? 'Add people to this thread' : 'People in this thread'}
      footer={
        adding ? (
          <Button block disabled={busy || picked.length === 0} onClick={add}>
            Add {picked.length || ''}
          </Button>
        ) : (
          <Button block variant="secondary" icon={UserPlus} onClick={() => setAdding(true)}>
            Add people
          </Button>
        )
      }
    >
      <div className="px-2 pb-2">
        {adding ? (
          candidates.length === 0 ? (
            <EmptyState icon={UserPlus} title="Everyone already follows" body="There's nobody else to add." />
          ) : (
            candidates.map((u) => {
              const on = picked.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setPicked((p) => (on ? p.filter((x) => x !== u.id) : [...p, u.id]))}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left active:bg-surface-2"
                >
                  <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                  <span className="flex-1 text-[15px]">{u.name}</span>
                  <span className={cx('grid h-6 w-6 place-items-center rounded-md border', on ? 'border-accent bg-accent text-on-accent' : 'border-line-strong')}>
                    {on && <Icon as={Check} size={14} />}
                  </span>
                </button>
              );
            })
          )
        ) : loading && !data ? (
          <SkeletonRows count={3} />
        ) : (
          <>
            {(data?.followers || []).map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar name={f.username || '?'} src={f.avatarUrl} size="sm" />
                <span className="flex-1 text-[15px]">
                  {f.username || 'Someone'}
                  {f.id === me && <span className="text-text-2"> (you)</span>}
                </span>
                {(f.id === me || data?.canModerate) && (
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={f.id === me ? 'Leave this thread' : `Remove ${f.username || 'them'}`}
                    onClick={() => remove(f)}
                    className={cx('grid h-9 w-9 place-items-center rounded-full active:bg-surface-2', f.id === me ? 'text-text-2' : 'text-danger')}
                  >
                    <Icon as={UserMinus} size={17} />
                  </button>
                )}
              </div>
            ))}
            <p className="px-3 pt-1 text-xs text-text-2">Followers are notified about every new reply. Everyone in the conversation can still read the thread.</p>
          </>
        )}
      </div>
    </Sheet>
  );
}
