import { useState } from 'react';
import { ChevronRight, Link2, Plus } from 'lucide-react';
import { useSession } from '../../data/session.js';
import { Icon } from '../../ui/Icon.jsx';
import { Badge } from '../../ui/Feedback.jsx';
import { WorkspaceTile } from './WorkspaceTile.jsx';
import { JoinWithLinkSheet } from './JoinWorkspace.jsx';

/**
 * Right after signing in: "Welcome back", and the workspaces this account belongs to.
 * Tapping one opens it. Shown once per sign-in; reopening the app goes to the last workspace.
 */
export function WorkspacePicker() {
  const user = useSession((s) => s.user);
  const workspaces = useSession((s) => s.workspaces);
  const choose = useSession((s) => s.chooseWorkspace);
  const signOut = useSession((s) => s.signOut);
  const openCreate = useSession((s) => s.openCreateWorkspace);
  const firstName = String(user?.name || user?.username || '').split(' ')[0];
  const [joinLink, setJoinLink] = useState(false);

  // Most active first.
  const sorted = [...workspaces].sort((a, b) => (b.unread || 0) - (a.unread || 0));

  return (
    <div className="flex h-full flex-col bg-bg pt-safe pb-safe">
      <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-5 pb-10 pt-8">
        <h1 className="text-[28px] font-bold tracking-tight">Welcome back{firstName ? `, ${firstName}` : ''}</h1>
        <p className="mt-1.5 text-[15px] text-text-2">
          {sorted.length > 1 ? 'You belong to these workspaces. Pick one to open.' : 'Here is your workspace.'}
        </p>
        <p className="mt-1 text-[13px] text-text-3">Signed in as {user?.email}</p>

        <ul className="mt-6 overflow-hidden rounded-card border border-line-soft divide-y divide-line-soft bg-surface">
          {sorted.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => choose(w.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface-2"
                data-testid="workspace-pick"
              >
                <WorkspaceTile workspace={w} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-medium">{w.name}</span>
                  <span className="block truncate text-[13px] text-text-2">
                    {[w.role && w.role.charAt(0).toUpperCase() + w.role.slice(1), w.memberCount && `${w.memberCount} ${w.memberCount === 1 ? 'member' : 'members'}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <Badge count={w.unread} muted />
                <Icon as={ChevronRight} size="sm" className="text-text-3" />
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={openCreate}
          className="mt-4 flex w-full items-center gap-3 rounded-card border border-line-soft px-4 py-3.5 text-left active:bg-surface-2"
          data-testid="create-workspace"
        >
          <span className="grid h-11 w-11 place-items-center rounded-[9px] border border-dashed border-line text-text-2">
            <Icon as={Plus} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-medium">Create a new workspace</span>
            <span className="block text-[13px] text-text-2">For your team, company or project</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setJoinLink(true)}
          className="mt-2.5 flex w-full items-center gap-3 rounded-card border border-line-soft px-4 py-3.5 text-left active:bg-surface-2"
          data-testid="join-with-link"
        >
          <span className="grid h-11 w-11 place-items-center rounded-[9px] border border-dashed border-line text-text-2">
            <Icon as={Link2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-medium">Join with a link</span>
            <span className="block text-[13px] text-text-2">Paste an invitation someone sent you</span>
          </span>
        </button>

        <p className="mt-8 text-center text-sm text-text-2">
          Not you?{' '}
          <button type="button" className="font-medium text-accent-ink underline" onClick={() => signOut()}>
            Use a different account
          </button>
        </p>
      </div>
      <JoinWithLinkSheet open={joinLink} onClose={() => setJoinLink(false)} />
    </div>
  );
}
