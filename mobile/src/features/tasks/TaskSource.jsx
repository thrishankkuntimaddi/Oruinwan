// "From note: <title>" / "From file: <name>" on a task made from a note or a file.
import { FileText, Paperclip } from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api } from '../../data/session.js';
import { useQuery } from '../../data/query.js';
import { Row } from '../../ui/List.jsx';

export function taskSource(task) {
  if (task?.linkedNote) return { kind: 'note', id: task.linkedNote };
  if (task?.linkedFile) return { kind: 'file', id: task.linkedFile };
  return null;
}

/** A row in the task's details that opens the note or file. People who can't open it see only the kind. */
export function TaskSourceRow({ task }) {
  const source = taskSource(task);
  const kind = source?.kind;
  const id = source?.id;
  const { data, error } = useQuery(
    id ? `${kind}:${id}` : null,
    () => (kind === 'note' ? api().note(id) : api().fileDetail(id)),
    { enabled: Boolean(id) },
  );
  if (!source) return null;
  const name = kind === 'note' ? data?.title : data?.name;
  const value = error ? "Can't open" : name || '…';
  return (
    <Row
      icon={kind === 'note' ? FileText : Paperclip}
      title={kind === 'note' ? 'From note' : 'From file'}
      value={value}
      onClick={error ? undefined : () => nav.push(kind, { id }, kind === 'note' ? { tab: 'notes' } : undefined)}
    />
  );
}
