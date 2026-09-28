import { useOptionalWorkspace } from '../../contexts/WorkspaceContext';

/**
 * true when the signed-in user is an owner or admin of `workspaceId` (as reported by
 * /api/workspaces/my); undefined while the workspace list is still loading.
 * UI hint only — the server enforces every admin action.
 */
export default function useIsWorkspaceAdmin(workspaceId) {
  const ctx = useOptionalWorkspace();
  if (!ctx) return false;
  const ws = (ctx.workspaces || []).find(w => String(w.id) === String(workspaceId))
    || (ctx.activeWorkspace && String(ctx.activeWorkspace.id) === String(workspaceId) ? ctx.activeWorkspace : null);
  if (!ws && ctx.loading) return undefined;
  return ws?.role === 'owner' || ws?.role === 'admin';
}
