import { COMING_SOON_LINE } from '../../features/plan/planLimit';

/** Workspaces you may create on the free plan when GET /api/plan has not answered yet. */
export const FREE_WORKSPACE_CREATE_FALLBACK = 2;

/**
 * Who may create a workspace from /workspaces (shared by the hero button, the grid tile and the empty state).
 * `plan` is GET /api/plan (user level): blocked['workspaces.create'] decides; company plans are exempt.
 * Without it, personal accounts fall back to the free plan's 2 created workspaces.
 */
export function getCreatePolicy(user, workspaces = [], plan = null) {
    const ownedWorkspacesCount = workspaces.filter(ws => ws.isOwner).length;
    const max = plan?.limits?.['workspaces.create'] ?? FREE_WORKSPACE_CREATE_FALLBACK;
    let isLimitReached;
    if (plan) isLimitReached = !plan.exempt && !!plan.blocked?.['workspaces.create'];
    else isLimitReached = user?.userType === 'personal' && ownedWorkspacesCount >= FREE_WORKSPACE_CREATE_FALLBACK;
    const isCompanyMember = user?.companyRole === 'member' && user?.userType !== 'personal';
    const companyName = user?.companyName || 'your company';
    const limitMessage = isLimitReached
        ? `You've reached the free plan limit: ${max} workspaces you created. ${COMING_SOON_LINE}`
        : '';
    return { isLimitReached, isCompanyMember, companyName, canCreate: !isLimitReached && !isCompanyMember, limitMessage, maxCreated: max };
}
