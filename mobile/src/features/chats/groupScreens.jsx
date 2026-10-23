// Group DMs on the phone: start one, and its info screen (people, rename, add, remove, leave).
import { useEffect, useMemo, useState } from 'react';
import { Users, UserPlus, LogOut, Pencil, Check } from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { useMembers } from '../../data/hooks.js';
import { invalidate } from '../../data/query.js';
import { Header, Screen, Body } from '../../ui/Screen.jsx';
import { Button } from '../../ui/Button.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Field, SearchField } from '../../ui/Controls.jsx';
import { Dialog, Sheet } from '../../ui/Overlay.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { toast } from '../../lib/bus.js';
import { cx } from '../../ui/cx.js';
import { openConversation } from './chatsUi.js';

/** Largest group, me included (server: DMSession.MAX_GROUP_DM_MEMBERS). */
export const MAX_GROUP_MEMBERS = 10;

/** Round tile with a people icon, for group DMs in lists and headers. */
export function GroupTile({ size = 44 }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-text-2" style={{ width: size, height: size }} aria-hidden>
      <Icon as={Users} size={size > 40 ? 20 : 16} />
    </span>
  );
}

function Tick({ on }) {
  return (
    <span className={cx('grid size-6 place-items-center rounded-full border', on ? 'border-gold bg-gold text-on-accent' : 'border-line')} aria-hidden>
      {on && <Icon as={Check} size={14} />}
    </span>
  );
}

/** Toggles a person in a picked list. Exported for tests. */
export function togglePicked(list, id, max = MAX_GROUP_MEMBERS - 1) {
  if (list.includes(id)) return list.filter((x) => x !== id);
  if (list.length >= max) return list;
  return [...list, id];
}

export function NewGroupScreen() {
  const { data: members, loading } = useMembers();
  const me = useSession((s) => s.user?.id);
  const ws = useSession((s) => s.workspaceId);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const people = (members || []).filter((u) => u.id !== me && (!query || u.name.toLowerCase().includes(query.toLowerCase())));

  const create = async () => {
    setBusy(true);
    try {
      const group = await api().createGroupDm(ws, picked, name);
      invalidate('dms');
      nav.pop();
      openConversation('dm', group.id);
    } catch (err) {
      toast(err.message || 'Could not start the group', 'danger');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="New group">
        <div className="px-4 pb-3">
          <SearchField value={query} onChange={setQuery} placeholder="Search people" autoFocus />
        </div>
      </Header>
      <Body>
        <div className="px-4 pt-2">
          <Field label="Group name (optional)" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Launch crew" maxLength={80} />
          <p className="mt-2 text-[13px] text-text-2">
            {picked.length < 2 ? 'Pick at least 2 people.' : `${picked.length + 1} people, including you.`} Up to {MAX_GROUP_MEMBERS}.
          </p>
        </div>
        <Section title="People">
          {loading ? (
            <SkeletonRows count={6} />
          ) : people.length ? (
            <RowGroup>
              {people.map((u) => {
                const on = picked.includes(u.id);
                return (
                  <Row
                    key={u.id}
                    leading={<Avatar name={u.name} src={u.avatarUrl} size="sm" presence={u.presence} />}
                    title={u.name}
                    subtitle={u.title || u.email}
                    trailing={<Tick on={on} />}
                    chevron={false}
                    onClick={() => setPicked((list) => togglePicked(list, u.id))}
                  />
                );
              })}
            </RowGroup>
          ) : (
            <EmptyState icon={Users} title="No one found" body="Only people in this workspace can join a group." />
          )}
        </Section>
      </Body>
      <div className="border-t border-line px-4 py-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <Button block onClick={create} loading={busy} disabled={picked.length < 2}>
          {picked.length < 2 ? 'Start group' : `Start group (${picked.length + 1})`}
        </Button>
      </div>
    </Screen>
  );
}

export function GroupInfoScreen({ id }) {
  const me = useSession((s) => s.user?.id);
  const { data: members } = useMembers();
  const [group, setGroup] = useState(null);
  const [rename, setRename] = useState(false);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState([]);
  const [leave, setLeave] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api().dmDetails(id)
      .then((g) => alive && setGroup(g))
      .catch((err) => toast(err.message || 'Could not load the group', 'danger'));
    return () => { alive = false; };
  }, [id]);

  const inGroup = useMemo(() => new Set((group?.members || []).map((m) => m.id)), [group]);
  const candidates = (members || []).filter((u) => !inGroup.has(u.id));
  const isCreator = group && String(group.createdBy) === String(me);
  const room = MAX_GROUP_MEMBERS - (group?.members?.length || 0);

  const run = async (fn, done) => {
    setBusy(true);
    try {
      const next = await fn();
      if (next) setGroup(next);
      invalidate('dms');
      done?.();
    } catch (err) {
      toast(err.message || 'Something went wrong', 'danger');
    } finally {
      setBusy(false);
    }
  };

  if (!group) {
    return (
      <Screen>
        <Header title="Group" />
        <SkeletonRows />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Group info" />
      <Body>
        <div className="flex flex-col items-center px-6 pt-4 pb-2 text-center">
          <GroupTile size={64} />
          <h1 className="mt-3 text-2xl font-bold">{group.name}</h1>
          <p className="mt-1 text-sm text-text-2">{group.members.length} people</p>
        </div>
        <Section>
          <RowGroup>
            <Row icon={Pencil} tile="accent" title={group.groupName ? 'Rename group' : 'Name this group'} onClick={() => { setName(group.groupName || ''); setRename(true); }} />
            {room > 0 && <Row icon={UserPlus} tile="accent" title="Add people" onClick={() => { setPicked([]); setAdding(true); }} />}
          </RowGroup>
        </Section>
        <Section title={`People · ${group.members.length}`}>
          <RowGroup>
            {group.members.map((u) => {
              const mine = u.id === me;
              return (
                <Row
                  key={u.id}
                  leading={<Avatar name={u.name} src={u.avatarUrl} size="sm" presence={u.presence} />}
                  title={mine ? 'You' : u.name}
                  subtitle={String(group.createdBy) === u.id ? 'Created the group' : u.title || null}
                  trailing={isCreator && !mine ? (
                    <button type="button" className="text-[13px] text-danger" disabled={busy} onClick={(e) => { e.stopPropagation(); run(async () => { await api().removeGroupDmMember(id, u.id); return api().dmDetails(id); }); }}>
                      Remove
                    </button>
                  ) : null}
                  chevron={!mine}
                  onClick={mine ? undefined : () => nav.push('profile', { userId: u.id })}
                />
              );
            })}
          </RowGroup>
        </Section>
        <Section>
          <RowGroup>
            <Row icon={LogOut} danger title="Leave group" onClick={() => setLeave(true)} />
          </RowGroup>
        </Section>
      </Body>

      <Sheet
        open={rename}
        onClose={() => setRename(false)}
        title="Group name"
        footer={<Button block loading={busy} onClick={() => run(() => api().renameGroupDm(id, name), () => setRename(false))}>Save</Button>}
      >
        <div className="px-5 pb-4">
          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Leave empty to show people's names" maxLength={80} autoFocus />
        </div>
      </Sheet>

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="Add people"
        footer={<Button block loading={busy} disabled={picked.length === 0} onClick={() => run(() => api().addGroupDmMembers(id, picked), () => setAdding(false))}>Add {picked.length || ''}</Button>}
      >
        <div className="px-2 pb-4">
          {candidates.length ? (
            <RowGroup>
              {candidates.map((u) => (
                <Row
                  key={u.id}
                  leading={<Avatar name={u.name} src={u.avatarUrl} size="sm" />}
                  title={u.name}
                  trailing={<Tick on={picked.includes(u.id)} />}
                  chevron={false}
                  onClick={() => setPicked((list) => togglePicked(list, u.id, room))}
                />
              ))}
            </RowGroup>
          ) : (
            <p className="px-3 py-6 text-center text-sm text-text-2">Everyone in this workspace is already here.</p>
          )}
        </div>
      </Sheet>

      <Dialog
        open={leave}
        onClose={() => setLeave(false)}
        title="Leave this group?"
        body="You'll stop getting its messages. Someone in the group can add you back."
        confirmLabel="Leave"
        danger
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api().leaveGroupDm(id);
            invalidate('dms');
            setLeave(false);
            nav.pop();
            nav.pop();
          } catch (err) {
            toast(err.message || 'Could not leave the group', 'danger');
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
