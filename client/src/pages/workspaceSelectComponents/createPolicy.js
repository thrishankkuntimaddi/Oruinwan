/** Who may create a workspace from /workspaces (shared by the hero button, the grid tile and the empty state). */
export function getCreatePolicy(user, workspaces = []) {
    const ownedWorkspacesCount = workspaces.filter(ws => ws.isOwner).length;
    const isLimitReached = user?.userType === 'personal' && ownedWorkspacesCount >= 3;
    const isCompanyMember = user?.companyRole === 'member' && user?.userType !== 'personal';
    const companyName = user?.companyName || 'your company';
    return { isLimitReached, isCompanyMember, companyName, canCreate: !isLimitReached && !isCompanyMember };
}
