// client/src/components/company/EmployeeActionsMenu.jsx
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { MoreVertical, UserX, UserCheck, Trash2, Building, Award } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@services/api';

// viewerRole: the companyRole of the currently logged-in user
const EmployeeActionsMenu = ({ employee, departments = [], onUpdate, viewerRole = 'member' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0, openUpward: false });
    const [showSuspendModal, setShowSuspendModal] = useState(false);
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [showDepartmentModal, setShowDepartmentModal] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [suspensionReason, setSuspensionReason] = useState('');
    const [selectedDepartments, setSelectedDepartments] = useState(employee.departments?.map(d => d._id || d) || []);
    const [selectedRole, setSelectedRole] = useState(employee.companyRole);
    const [managedDepts, setManagedDepts] = useState(employee.managedDepartments?.map(d => d._id || d) || []);
    const [loading, setLoading] = useState(false);
    const btnRef = useRef(null);

    // Close on scroll or resize
    useEffect(() => {
        if (!isOpen) return;
        const close = () => setIsOpen(false);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [isOpen]);

    const viewerIsAdminOrAbove = viewerRole === 'owner' || viewerRole === 'admin';
    const viewerIsOwner = viewerRole === 'owner';

    // Target-based guards
    const canSuspend = employee.companyRole !== 'owner' && employee.accountStatus === 'active' && viewerIsAdminOrAbove;
    const canActivate = employee.accountStatus === 'suspended' && viewerIsAdminOrAbove;
    const canRemove = employee.companyRole !== 'owner' && employee.accountStatus !== 'removed' && viewerIsAdminOrAbove;

    // Viewer can change roles only if they are admin/owner AND the target is not an equal/higher rank
    const targetRank = { owner: 3, admin: 2, manager: 1, member: 0, guest: 0 };
    const viewerRank = targetRank[viewerRole] ?? 0;
    const employeeRank = targetRank[employee.companyRole] ?? 0;
    const canChangeRole = viewerIsAdminOrAbove && viewerRank > employeeRank;

    const handleSuspend = async () => {
        if (!suspensionReason.trim()) {
            toast.error('Please provide a reason for suspension');
            return;
        }

        setLoading(true);
        try {
            await api.put(`/api/admin/employees/${employee._id}/suspend`, {
                reason: suspensionReason
            });
            toast.success('Employee suspended successfully');
            setShowSuspendModal(false);
            setSuspensionReason('');
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to suspend employee');
        } finally {
            setLoading(false);
        }
    };

    const handleActivate = async () => {
        setLoading(true);
        try {
            await api.put(`/api/admin/employees/${employee._id}/activate`);
            toast.success('Employee activated successfully');
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to activate employee');
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async () => {
        setLoading(true);
        try {
            await api.delete(`/api/admin/employees/${employee._id}`);
            toast.success('Employee removed successfully');
            setShowRemoveModal(false);
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to remove employee');
        } finally {
            setLoading(false);
        }
    };

    const handleDepartmentUpdate = async () => {
        if (selectedDepartments.length === 0) {
            toast.error('Please select at least one department');
            return;
        }

        setLoading(true);
        try {
            await api.put(`/api/admin/employees/${employee._id}/assign-department`, {
                departmentIds: selectedDepartments
            });
            toast.success('Department assignment updated');
            setShowDepartmentModal(false);
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update departments');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleUpdate = async () => {
        if (selectedRole === 'manager' && managedDepts.length === 0) {
            toast.error('Managers must have at least one managed department');
            return;
        }

        setLoading(true);
        try {
            await api.put(`/api/admin/employees/${employee._id}/change-role`, {
                role: selectedRole,
                managedDepartments: selectedRole === 'manager' ? managedDepts : []
            });
            toast.success('Employee role updated');
            setShowRoleModal(false);
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update role');
        } finally {
            setLoading(false);
        }
    };

    const toggleDepartment = (deptId) => {
        setSelectedDepartments(prev =>
            prev.includes(deptId)
                ? prev.filter(id => id !== deptId)
                : [...prev, deptId]
        );
    };

    const toggleManagedDept = (deptId) => {
        setManagedDepts(prev =>
            prev.includes(deptId)
                ? prev.filter(id => id !== deptId)
                : [...prev, deptId]
        );
    };

    return (
        <>
            <div className="relative">
                <button
                    ref={btnRef}
                    onClick={() => {
                        if (btnRef.current) {
                            const rect = btnRef.current.getBoundingClientRect();
                            const MENU_HEIGHT = 220; // estimated
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const openUpward = spaceBelow < MENU_HEIGHT;
                            setMenuPos({
                                // position from right edge of viewport
                                right: window.innerWidth - rect.right,
                                top: openUpward ? undefined : rect.bottom + 6,
                                bottom: openUpward ? window.innerHeight - rect.top + 6 : undefined,
                                openUpward,
                            });
                        }
                        setIsOpen(prev => !prev);
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Actions"
                >
                    <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
            </div>

            {/* Portal dropdown — rendered at document.body to escape overflow-hidden */}
            {isOpen && ReactDOM.createPortal(
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-[9998]"
                        onClick={() => setIsOpen(false)}
                    />
                    {/* Menu */}
                    <div
                        style={{
                            position: 'fixed',
                            right: menuPos.right,
                            top: menuPos.openUpward ? undefined : menuPos.top,
                            bottom: menuPos.openUpward ? menuPos.bottom : undefined,
                            zIndex: 9999,
                            minWidth: '224px',
                        }}
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="py-2">
                            {canActivate && (
                                <button
                                    onClick={() => {
                                        handleActivate();
                                        setIsOpen(false);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-green-600 dark:text-green-400"
                                >
                                    <UserCheck className="w-4 h-4" />
                                    Activate Employee
                                </button>
                            )}

                            {canSuspend && (
                                <button
                                    onClick={() => {
                                        setShowSuspendModal(true);
                                        setIsOpen(false);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-orange-600 dark:text-orange-400"
                                >
                                    <UserX className="w-4 h-4" />
                                    Suspend Employee
                                </button>
                            )}

                            {viewerIsAdminOrAbove && (
                                <button
                                    onClick={() => {
                                        setShowDepartmentModal(true);
                                        setIsOpen(false);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-300"
                                >
                                    <Building className="w-4 h-4" />
                                    Assign Departments
                                </button>
                            )}

                            {canChangeRole && (
                                <button
                                    onClick={() => {
                                        setShowRoleModal(true);
                                        setIsOpen(false);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-300"
                                >
                                    <Award className="w-4 h-4" />
                                    Change Role
                                </button>
                            )}

                            {canRemove && (
                                <>
                                    <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
                                    <button
                                        onClick={() => {
                                            setShowRemoveModal(true);
                                            setIsOpen(false);
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 text-red-600 dark:text-red-400"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Remove Employee
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </>,
                document.body
            )}

            {/* Suspend Modal */}
            {showSuspendModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                            Suspend Employee
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Suspending <strong>{employee.username}</strong> will prevent them from accessing the system.
                        </p>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Reason for Suspension <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={suspensionReason}
                                onChange={(e) => setSuspensionReason(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-orange-500"
                                rows="3"
                                placeholder="Enter reason for suspension..."
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowSuspendModal(false);
                                    setSuspensionReason('');
                                }}
                                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSuspend}
                                disabled={loading}
                                className="flex-1 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium disabled:opacity-50"
                            >
                                {loading ? 'Suspending...' : 'Suspend'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Remove Modal */}
            {showRemoveModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
                            Remove Employee
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            Are you sure you want to remove <strong>{employee.username}</strong>? This action will mark their account as removed.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowRemoveModal(false)}
                                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRemove}
                                disabled={loading}
                                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50"
                            >
                                {loading ? 'Removing...' : 'Remove'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Department Assignment Modal */}
            {showDepartmentModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                            Assign Departments
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Select departments for <strong>{employee.username}</strong>
                        </p>
                        <div className="mb-6 max-h-64 overflow-y-auto space-y-2">
                            {departments.map((dept) => (
                                <label key={dept._id} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedDepartments.includes(dept._id)}
                                        onChange={() => toggleDepartment(dept._id)}
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-900 dark:text-white">{dept.name}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDepartmentModal(false)}
                                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDepartmentUpdate}
                                disabled={loading}
                                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
                            >
                                {loading ? 'Updating...' : 'Update'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Role Change Modal */}
            {showRoleModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                            Change Role
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Update role for <strong>{employee.username}</strong>
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Role
                            </label>
                            <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="member">Employee</option>
                            <option value="guest">Guest</option>
                            <option value="manager">Manager</option>
                            {/* Only owners can promote to admin; admins cannot create peer admins */}
                            {viewerIsOwner && <option value="admin">Admin</option>}
                        </select>
                        </div>

                        {selectedRole === 'manager' && (
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Managed Departments
                                </label>
                                <div className="max-h-40 overflow-y-auto space-y-2">
                                    {departments.map((dept) => (
                                        <label key={dept._id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={managedDepts.includes(dept._id)}
                                                onChange={() => toggleManagedDept(dept._id)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-900 dark:text-white">{dept.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowRoleModal(false)}
                                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRoleUpdate}
                                disabled={loading}
                                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
                            >
                                {loading ? 'Updating...' : 'Update Role'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default EmployeeActionsMenu;
