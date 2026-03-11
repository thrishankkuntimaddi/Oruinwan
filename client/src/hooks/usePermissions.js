// client/src/hooks/usePermissions.js
//
// Central role-based permission flags derived from user.companyRole.
// All components should import from here — no duplicated role string comparisons.
//
// companyRole hierarchy (highest → lowest):
//   owner > admin > manager > member > guest

import { useAuth } from '../contexts/AuthContext';

/**
 * Returns named boolean permission flags for the currently logged-in user.
 *
 * @returns {{
 *   companyRole: string,
 *   isOwner: boolean,
 *   isAdmin: boolean,
 *   isAdminOrAbove: boolean,
 *   isManagerOrAbove: boolean,
 *   canPostUpdates: boolean,
 *   canManageWorkspace: boolean,
 *   canInviteUsers: boolean,
 *   canChangeRoles: boolean,
 *   canSuspendUsers: boolean,
 *   canPromoteToAdmin: boolean,
 * }}
 */
export function usePermissions() {
    const { user } = useAuth();
    const companyRole = user?.companyRole || 'member';

    const isOwner         = companyRole === 'owner';
    const isAdmin         = companyRole === 'admin';
    const isAdminOrAbove  = isOwner || isAdmin;
    const isManagerOrAbove = isOwner || isAdmin || companyRole === 'manager';

    return {
        companyRole,

        // Basic role booleans
        isOwner,
        isAdmin,
        isAdminOrAbove,
        isManagerOrAbove,

        // Named action flags
        /** Managers, admins, and owners can post company updates */
        canPostUpdates:     isManagerOrAbove,

        /** Only admins and owners can create/manage workspaces */
        canManageWorkspace: isAdminOrAbove,

        /** Only admins and owners can invite new company users */
        canInviteUsers:     isAdminOrAbove,

        /** Only admins/owners can change employee roles */
        canChangeRoles:     isAdminOrAbove,

        /** Only admins/owners can suspend or remove employees */
        canSuspendUsers:    isAdminOrAbove,

        /** Only owners can promote someone to admin/owner */
        canPromoteToAdmin:  isOwner,
    };
}
