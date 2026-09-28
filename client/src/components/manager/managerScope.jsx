import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import { LoadingState, ErrorState, EmptyState } from '../company-dash/dashUi';
import './manager.css';

const isObjectId = (id) => /^[a-f\d]{24}$/i.test(String(id ?? ''));

/**
 * The Manager console's department scope (from ManagerLayout's outlet context).
 * `departmentId` is only set when it is a real id.
 */
export function useDepartment() {
    const ctx = useOutletContext() || {};
    const dept = ctx.selectedDepartment || null;
    return {
        ...ctx,
        department: dept,
        departmentId: dept && isObjectId(dept._id) ? String(dept._id) : null,
    };
}

/**
 * Renders the loading / error / "no department" state for a department-scoped
 * page, or `children` once a department is chosen.
 */
export function DepartmentGate({ scope, children }) {
    if (scope.departmentsLoading) return <LoadingState label="Loading your departments…" />;
    if (scope.departmentsError) return <ErrorState message={scope.departmentsError} onRetry={scope.reloadDepartments} />;
    if (!scope.departmentId) {
        return (
            <EmptyState
                icon={Briefcase}
                title="No department yet"
                text="You don't manage a department yet. Ask a company admin to make you the manager of a department in Departments."
            />
        );
    }
    return children;
}

/** Percentage helper that never invents a number: null when the base is 0. */
export const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null);
