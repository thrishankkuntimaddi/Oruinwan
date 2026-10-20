import { useState } from 'react';
import { Check, Settings2, Globe, Link2, Plus } from 'lucide-react';
import { useSession } from '../../data/session.js';
import { nav } from '../../app/nav.js';
import { Sheet } from '../../ui/Overlay.jsx';
import { Badge } from '../../ui/Feedback.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { WorkspaceTile } from './WorkspaceTile.jsx';
import { toast } from '../../lib/bus.js';
import { JoinWithLinkSheet } from './JoinWorkspace.jsx';

export function WorkspaceSheet({ open, onClose }) {
  const workspaces = useSession((s) => s.workspaces);
  const current = useSession((s) => s.workspaceId);
  const switchWorkspace = useSession((s) => s.switchWorkspace);
  const server = useSession((s) => s.server);
  const openCreate = useSession((s) => s.openCreateWorkspace);
  const [joinLink, setJoinLink] = useState(false);

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Workspaces">
        <div className="px-2 pb-2">
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                onClose();
                if (w.id !== current) {
                  switchWorkspace(w.id);
                  toast(`Switched to ${w.name}`);
                }
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left active:bg-surface-2"
            >
              <WorkspaceTile workspace={w} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{w.name}</span>
                <span className="block truncate text-[13px] text-text-2">
                  {[
                    w.role && w.role.charAt(0).toUpperCase() + w.role.slice(1),
                    w.memberCount && `${w.memberCount} ${w.memberCount === 1 ? 'member' : 'members'}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              {w.id === current ? <Icon as={Check} className="text-accent-ink" /> : <Badge count={w.unread} muted />}
            </button>
          ))}
        </div>
        <div className="mx-4 mb-4 mt-1 overflow-hidden rounded-card border border-line-soft divide-y divide-line-soft">
          <button
            type="button"
            onClick={() => {
              onClose();
              nav.push('workspace');
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2"
          >
            <Icon as={Settings2} size="sm" className="text-text-2" />
            <span className="text-[15px]">Workspace details</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              openCreate();
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2"
          >
            <Icon as={Plus} size="sm" className="text-text-2" />
            <span className="text-[15px]">Create a workspace</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              setJoinLink(true);
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2"
          >
            <Icon as={Link2} size="sm" className="text-text-2" />
            <span className="text-[15px]">Join with a link</span>
          </button>
          <div className="flex items-center gap-3 px-4 py-3">
            <Icon as={Globe} size="sm" className="text-text-2" />
            <span className="min-w-0 flex-1 text-[13px] text-text-2">
              {`Manage workspaces at ${server.replace(/^https?:\/\//, '')}`}
            </span>
          </div>
        </div>
      </Sheet>
      <JoinWithLinkSheet open={joinLink} onClose={() => setJoinLink(false)} />
    </>
  );
}
