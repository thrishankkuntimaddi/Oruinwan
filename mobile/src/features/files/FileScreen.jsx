// One file from the workspace library: open it, tags, versions (upload a new one, restore an
// old one), comments and who it is shared with.
import { useRef, useState } from 'react';
import { ExternalLink, File, MessageSquare, RotateCcw, Send, Tag, Upload, X } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { useDirectory } from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { toast } from '../../lib/bus.js';
import { formatBytes } from '../../lib/files.js';
import { shortAgo } from '../../lib/time.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Field } from '../../ui/Controls.jsx';
import { ActionSheet, Dialog, Sheet } from '../../ui/Overlay.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { FILE_ICONS } from '../media/Attachments.jsx';
import { openFile } from '../media/media.js';
import { PeoplePicker } from '../tasks/TaskEditorSheet.jsx';
import { normalizeTags } from './filesUi.js';

const ROLES = { view: 'Can view', edit: 'Can edit', download: 'Can download' };

function Tags({ file }) {
  const [draft, setDraft] = useState('');
  const save = async (tags) => {
    setQueryData(`file:${file.id}`, (f) => (f ? { ...f, tags } : f));
    try {
      await api().setFileTags(file.id, tags);
      invalidate('files');
    } catch (err) {
      toast(err.message || "Couldn't save the tags", 'danger');
      invalidate(`file:${file.id}`);
    }
  };
  const add = (e) => {
    e.preventDefault();
    const next = normalizeTags([...file.tags, ...draft.split(',')]);
    if (next.length !== file.tags.length) save(next);
    setDraft('');
  };
  return (
    <Section title="Tags">
      <div className="mx-4 rounded-card border border-line-soft bg-surface p-3">
        <div className="flex flex-wrap gap-2">
          {file.tags.map((t) => (
            <span key={t} className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface-2 pr-1 pl-3 text-[13px]">
              {t}
              <button type="button" aria-label={`Remove tag ${t}`} onClick={() => save(file.tags.filter((x) => x !== t))} className="grid h-6 w-6 place-items-center rounded-full text-text-3 active:bg-surface-3">
                <Icon as={X} size={13} />
              </button>
            </span>
          ))}
          <form onSubmit={add} className="flex min-w-[8rem] flex-1 items-center gap-1.5">
            <Icon as={Tag} size={14} className="text-text-3" />
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a tag" aria-label="Add a tag" enterKeyHint="done" className="h-8 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-text-3" />
          </form>
        </div>
      </div>
    </Section>
  );
}

function Versions({ file }) {
  const key = `fileversions:${file.id}`;
  const { data, loading } = useQuery(key, () => api().fileVersions(file.id));
  const input = useRef(null);
  const [pending, setPending] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [restore, setRestore] = useState(null);

  const upload = async () => {
    setBusy(true);
    try {
      const saved = await api().uploadFileVersion(file.id, pending, note.trim());
      setQueryData(`file:${file.id}`, saved);
      invalidate(key, 'files');
      toast(`Version ${saved.version} uploaded`, 'success');
      setPending(null);
      setNote('');
    } catch (err) {
      toast(err.message || "Couldn't upload the new version", 'danger');
    } finally {
      setBusy(false);
    }
  };
  const doRestore = async () => {
    const v = restore;
    setRestore(null);
    try {
      const saved = await api().restoreFileVersion(file.id, v.id);
      setQueryData(`file:${file.id}`, saved);
      invalidate(key, 'files');
      toast(`Restored version ${v.number}`, 'success');
    } catch (err) {
      toast(err.message || "Couldn't restore that version", 'danger');
    }
  };

  return (
    <Section
      title={`Versions · current v${file.version}`}
      action={
        <button type="button" className="text-[13px] font-medium text-accent-ink" onClick={() => input.current?.click()}>
          Upload new
        </button>
      }
    >
      <input
        ref={input}
        type="file"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) setPending(f);
        }}
      />
      {loading ? (
        <SkeletonRows count={2} />
      ) : data?.versions?.length ? (
        <RowGroup>
          {data.versions.map((v) => (
            <div key={v.id} className="flex items-center gap-2 pr-2">
              <button type="button" onClick={() => openFile({ ...file, url: v.url, gcsPath: v.gcsPath, mimeType: v.mimeType || file.mimeType, size: v.size, name: `${file.name} (v${v.number})` })} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-surface-3 text-[12px] font-semibold text-text-2">v{v.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{v.note || `Version ${v.number}`}</span>
                  <span className="block truncate text-[13px] text-text-2">{[v.by?.name, formatBytes(v.size), shortAgo(v.at)].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
              <IconButton icon={RotateCcw} size="sm" label={`Restore version ${v.number}`} onClick={() => setRestore(v)} />
            </div>
          ))}
        </RowGroup>
      ) : (
        <p className="mx-4 rounded-card border border-dashed border-line px-4 py-4 text-sm text-text-2">No earlier versions. Upload a new one and the current file is kept here.</p>
      )}
      <Sheet open={Boolean(pending)} onClose={() => setPending(null)} title="Upload a new version" footer={<Button block icon={Upload} loading={busy} onClick={upload}>Upload</Button>}>
        <div className="space-y-4 px-5 pb-4">
          <p className="text-sm text-text-2">
            {pending?.name} · {formatBytes(pending?.size)}. The current file becomes version {file.version}.
          </p>
          <Field label="What changed (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Updated pricing table" />
        </div>
      </Sheet>
      <Dialog open={Boolean(restore)} onClose={() => setRestore(null)} title={`Restore version ${restore?.number}?`} body="The current file is kept as a version too, so nothing is lost." confirmLabel="Restore" onConfirm={doRestore} />
    </Section>
  );
}

function Comments({ file }) {
  const key = `filecomments:${file.id}`;
  const { data, loading } = useQuery(key, () => api().fileComments(file.id));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const c = await api().addFileComment(file.id, text.trim());
      setQueryData(key, (list) => [...(list || []), c]);
      setText('');
    } catch (err) {
      toast(err.message || "Couldn't post the comment", 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title={`Comments${data?.length ? ` · ${data.length}` : ''}`}>
      {loading ? (
        <SkeletonRows count={2} />
      ) : (
        (data || []).length > 0 && (
          <div className="mx-4 mb-3 space-y-3">
            {data.map((c) => (
              <div key={c.id} className="flex gap-3">
                <Avatar name={c.author?.name} src={c.author?.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1 rounded-2xl border border-line-soft bg-surface px-3.5 py-2.5">
                  <p className="text-[13px] font-medium">
                    {c.author?.name} <span className="font-normal text-text-3">· {shortAgo(c.at)}</span>
                  </p>
                  <p className="selectable mt-0.5 whitespace-pre-wrap text-[14px]">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        )
      )}
      <form onSubmit={send} className="mx-4 flex items-center gap-2 rounded-xl border border-line bg-input pr-1.5 pl-3.5">
        <Icon as={MessageSquare} size="sm" className="text-text-3" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment" aria-label="Add a comment" className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-3" />
        <IconButton icon={Send} label="Post comment" tone={text.trim() ? 'accent' : 'default'} disabled={busy || !text.trim()} type="submit" />
      </form>
    </Section>
  );
}

function Sharing({ file }) {
  const me = useSession((s) => s.user?.id);
  const directory = useDirectory();
  const owner = file.owner === me;
  const [picking, setPicking] = useState(false);
  const [rolePick, setRolePick] = useState(null); // { userIds }
  const share = async (userIds, role) => {
    try {
      const saved = await api().shareFile(file.id, userIds.map((userId) => ({ userId, role })));
      setQueryData(`file:${file.id}`, saved);
      toast('Sharing updated', 'success');
    } catch (err) {
      toast(err.message || "Couldn't update sharing", 'danger');
    }
  };
  return (
    <Section
      title="Shared with"
      action={
        owner && (
          <button type="button" className="text-[13px] font-medium text-accent-ink" onClick={() => setPicking(true)}>
            Add people
          </button>
        )
      }
    >
      <RowGroup footer={owner ? 'Everyone in the workspace can see and comment on files. People added here can also edit or download it.' : 'Only the person who uploaded a file can change who it is shared with.'}>
        <Row leading={<Avatar name={directory[file.owner]?.name || file.ownerName} src={directory[file.owner]?.avatarUrl} size="sm" />} title={directory[file.owner]?.name || file.ownerName || 'Owner'} value="Owner" />
        {file.permissions.map((p) => (
          <Row
            key={p.userId}
            leading={<Avatar name={directory[p.userId]?.name} src={directory[p.userId]?.avatarUrl} size="sm" />}
            title={directory[p.userId]?.name || 'Someone'}
            value={ROLES[p.role] || p.role}
            onClick={owner ? () => setRolePick({ userIds: [p.userId] }) : undefined}
          />
        ))}
      </RowGroup>
      {picking && (
        <PeoplePicker
          open
          title="Share with"
          value={[]}
          onChange={(ids) => {
            setPicking(false);
            const others = ids.filter((id) => id !== file.owner);
            if (others.length) setRolePick({ userIds: others });
          }}
          onClose={() => setPicking(false)}
        />
      )}
      <ActionSheet
        open={Boolean(rolePick)}
        onClose={() => setRolePick(null)}
        title="Access"
        actions={Object.entries(ROLES).map(([role, label]) => ({ label, onSelect: () => share(rolePick.userIds, role) }))}
      />
    </Section>
  );
}

export function FileScreen({ id }) {
  const { data: file, loading, refetch } = useQuery(`file:${id}`, () => api().fileDetail(id));
  if (!file) {
    return (
      <Screen>
        <Header title="File" />
        {loading ? <SkeletonRows count={4} /> : <EmptyState icon={File} title="File not found" body="It may have been deleted." />}
      </Screen>
    );
  }
  return (
    <Screen>
      <Header title={file.name} subtitle={`v${file.version}`} />
      <Body onRefresh={refetch}>
        <div className="mx-4 flex items-center gap-4 rounded-card border border-line-soft bg-surface p-4" style={{ backgroundImage: 'var(--glass)' }}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent-ink">
            <Icon as={FILE_ICONS[file.kind] || File} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold">{file.name}</p>
            <p className="truncate text-[13px] text-text-2">{[formatBytes(file.size), file.ownerName, shortAgo(file.updatedAt || file.at)].filter(Boolean).join(' · ')}</p>
          </div>
          <Button size="sm" icon={ExternalLink} onClick={() => openFile(file)}>
            Open
          </Button>
        </div>
        {file.description && <p className="mx-4 mt-3 text-sm text-text-2">{file.description}</p>}
        <Tags file={file} />
        <Versions file={file} />
        <Sharing file={file} />
        <Comments file={file} />
      </Body>
    </Screen>
  );
}

