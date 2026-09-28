import {
    LayoutDashboard, Users, Settings, Building, Shield, Activity, CreditCard, UserPlus,
    LifeBuoy, Briefcase, GitBranch, LayoutTemplate, Lock, UsersRound, BarChart3,
    ClipboardList, ShieldCheck, Contact, Gauge, FolderKanban, UserX, FileBarChart, CheckSquare, Globe,
} from 'lucide-react';

/**
 * Role helpers shared by the company dashboards. A co-owner (coOwnerOf equal
 * to the user's companyId) is treated as an owner, matching the server gates.
 */
export const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : '');
export const isCoOwner = (user) => !!(user?.isCoOwner || (user?.coOwnerOf && idOf(user.coOwnerOf) === idOf(user.companyId)));
export const isOwnerUser = (user) => user?.companyRole === 'owner' || isCoOwner(user);
export const isAdminUser = (user) => isOwnerUser(user) || user?.companyRole === 'admin';
export const isManagerUser = (user) => user?.companyRole === 'manager';

export const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', manager: 'Manager', member: 'Member', guest: 'Guest' };

/** Navigation for each console. `ctx` = { billingEnabled, hasWorkspaces, canAdmin }. */
export function navFor(role, ctx = {}) {
    if (role === 'owner') {
        return [
            { label: 'Overview', items: [
                { to: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { to: '/owner/analytics', label: 'Activity health', icon: Activity },
                { to: '/owner/insights', label: 'Insights', icon: BarChart3 },
                ...(ctx.billingEnabled ? [{ to: '/owner/billing', label: 'Billing & plan', icon: CreditCard }] : []),
                { to: '/owner/security', label: 'Security & risk', icon: Shield },
            ] },
            { label: 'Organization', items: [
                { to: '/owner/admins', label: 'Admins', icon: ShieldCheck },
                { to: '/owner/users', label: 'People', icon: Users },
                { to: '/owner/departments', label: 'Departments', icon: Building },
                { to: '/owner/workspaces', label: 'Workspaces', icon: Briefcase },
                { to: '/owner/onboard', label: 'Onboard', icon: UserPlus },
            ] },
            { label: 'Collaboration', items: [
                { to: '/owner/teams', label: 'Teams', icon: UsersRound },
                { to: '/owner/org-chart', label: 'Org chart', icon: GitBranch },
                { to: '/owner/employees', label: 'Directory', icon: Contact },
                { to: '/owner/workspace-templates', label: 'Workspace templates', icon: LayoutTemplate },
                { to: '/owner/workspace-permissions', label: 'Workspace permissions', icon: Lock },
            ] },
            { label: 'Governance', items: [
                { to: '/owner/permission-matrix', label: 'Permission matrix', icon: Shield },
                { to: '/owner/audit-logs', label: 'Audit logs', icon: ClipboardList },
                { to: '/owner/compliance-logs', label: 'Compliance logs', icon: ShieldCheck },
            ] },
            { label: 'System', items: [
                { to: '/owner/settings', label: 'Company settings', icon: Settings },
                { to: '/contact-admin', label: 'Support', icon: LifeBuoy },
            ] },
        ];
    }
    if (role === 'admin') {
        return [
            { label: 'Overview', items: [
                { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { to: '/admin/analytics', label: 'Analytics', icon: Activity },
                { to: '/admin/insights', label: 'Insights', icon: BarChart3 },
            ] },
            { label: 'Organization', items: [
                { to: '/admin/users', label: 'People', icon: Users },
                { to: '/admin/departments', label: 'Departments', icon: Building },
                { to: '/admin/workspaces', label: 'Workspaces', icon: Briefcase },
                { to: '/admin/onboard', label: 'Onboard', icon: UserPlus },
            ] },
            { label: 'Collaboration', items: [
                { to: '/admin/teams', label: 'Teams', icon: UsersRound },
                { to: '/admin/org-chart', label: 'Org chart', icon: GitBranch },
                { to: '/admin/employees', label: 'Directory', icon: Contact },
                { to: '/admin/workspace-templates', label: 'Workspace templates', icon: LayoutTemplate },
                { to: '/admin/workspace-permissions', label: 'Workspace permissions', icon: Lock },
            ] },
            { label: 'Governance', items: [
                { to: '/admin/security', label: 'Audit & security', icon: Shield },
                { to: '/admin/permission-matrix', label: 'Permission matrix', icon: Lock },
                { to: '/admin/audit-logs', label: 'Audit logs', icon: ClipboardList },
                { to: '/admin/compliance-logs', label: 'Compliance logs', icon: ShieldCheck },
            ] },
            { label: 'System', items: [
                { to: '/admin/settings', label: 'Settings', icon: Settings },
                { to: '/contact-admin', label: 'Support', icon: LifeBuoy },
            ] },
        ];
    }
    // manager
    return [
        { label: 'Overview', items: [
            { to: '/manager/dashboard/overview', label: 'Dashboard', icon: Gauge },
            { to: '/manager/dashboard/workspace', label: 'My workspaces', icon: Globe },
        ] },
        { label: 'Team', items: [
            { to: '/manager/dashboard/allocation', label: 'Team load', icon: Users },
            { to: '/manager/dashboard/projects', label: 'Projects', icon: FolderKanban },
            { to: '/manager/dashboard/unassigned', label: 'Unassigned', icon: UserX },
            { to: '/manager/dashboard/tasks', label: 'Tasks', icon: CheckSquare },
            { to: '/manager/dashboard/reports', label: 'Reports', icon: FileBarChart },
        ] },
        { label: 'System', items: [
            { to: '/manager/dashboard/settings', label: 'Settings', icon: Settings },
        ] },
    ];
}
