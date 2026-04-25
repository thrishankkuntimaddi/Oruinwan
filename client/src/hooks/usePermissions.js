import { useAuth } from '../contexts/AuthContext';

export function usePermissions() {
    const { user } = useAuth();
    const companyRole = user?.companyRole || 'member';

    const isOwner         = companyRole === 'owner';
    const isAdmin         = companyRole === 'admin';
    const isAdminOrAbove  = isOwner || isAdmin;
    const isManagerOrAbove = isOwner || isAdmin || companyRole === 'manager';

    return {
        companyRole,

        
        isOwner,
        isAdmin,
        isAdminOrAbove,
        isManagerOrAbove,

        
        
        canPostUpdates:     isManagerOrAbove,

        
        canManageWorkspace: isAdminOrAbove,

        
        canInviteUsers:     isAdminOrAbove,

        
        canChangeRoles:     isAdminOrAbove,

        
        canSuspendUsers:    isAdminOrAbove,

        
        canPromoteToAdmin:  isOwner,
    };
}
