import React from 'react';

/**
 * PermissionsTab Component
 * Manages workspace permission settings with toggle switches
 */
const PermissionsTab = ({
    isAdmin,
    permissions,
    savingPermissions,
    handlePermissionChange
}) => {
    return (
        <div className="space-y-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Control what members can do in this workspace.</p>

            <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800">
                <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Channel Creation</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Allow members to create new channels</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={permissions.allowMemberChannelCreation}
                        onChange={(e) => handlePermissionChange('allowMemberChannelCreation', e.target.checked)}
                        disabled={savingPermissions || !isAdmin}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
                </label>
            </div>

            <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800">
                <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Invite Members</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Allow members to invite new people</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={permissions.allowMemberInvite}
                        onChange={(e) => handlePermissionChange('allowMemberInvite', e.target.checked)}
                        disabled={savingPermissions || !isAdmin}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
                </label>
            </div>

            <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800">
                <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Admin Approval Required</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Require admin approval for new members</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={permissions.requireAdminApproval}
                        onChange={(e) => handlePermissionChange('requireAdminApproval', e.target.checked)}
                        disabled={savingPermissions || !isAdmin}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
                </label>
            </div>

            <div className="flex items-center justify-between py-4">
                <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Workspace Discoverable</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Make workspace visible in search</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={permissions.isDiscoverable}
                        onChange={(e) => handlePermissionChange('isDiscoverable', e.target.checked)}
                        disabled={savingPermissions || !isAdmin}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
                </label>
            </div>

            {!isAdmin && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-4">
                    <p className="text-sm text-yellow-800"><strong>Note:</strong> Only workspace administrators can change permissions.</p>
                </div>
            )}
        </div>
    );
};

export default PermissionsTab;
