import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, UserPlus } from 'lucide-react';
import { DashPage, PageHead, Btn, Grid, useAsync } from '../../components/company-dash/dashUi';
import { useToast } from '../../contexts/ToastContext';

import UsersAccess from './UsersAccess';
import DepartmentsView from './DepartmentsView';
import WorkspacesAccess from './WorkspacesAccess';
import AuditSecurity from './AuditSecurity';

import {
    getUsersAccess,
    getDepartmentsView,
    getWorkspacesAccess,
    getAuditSecurity,
} from '../../services/adminDashboardService';
import { errorMessage } from '../../components/company-dash/dashUi';
import '../admin/admin.css';

/** Each section loads on its own so one failing endpoint doesn't blank the page. */
const settle = async (fn) => {
    try { return { data: await fn(), error: null }; } catch (err) { return { data: null, error: errorMessage(err, 'Could not load this section') }; }
};

const AdminDashboard = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [refreshing, setRefreshing] = useState(false);

    const { data, loading, reload } = useAsync(async () => {
        const [users, depts, workspaces, audit] = await Promise.all([
            settle(getUsersAccess), settle(getDepartmentsView), settle(getWorkspacesAccess), settle(getAuditSecurity),
        ]);
        return { users, depts, workspaces, audit };
    }, []);

    const refresh = async () => {
        setRefreshing(true);
        await reload();
        setRefreshing(false);
        showToast('Dashboard refreshed', 'success');
    };

    const s = data || {};
    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Admin console"
                    title="Company overview"
                    lead="People, structure and compliance at a glance."
                    actions={(
                        <>
                            <Btn icon={RefreshCw} loading={refreshing} disabled={loading} onClick={refresh}>Refresh</Btn>
                            <Btn variant="primary" icon={UserPlus} onClick={() => navigate('/admin/onboard')}>Onboard people</Btn>
                        </>
                    )}
                />
            )}
        >
            <UsersAccess loading={loading} data={s.users?.data} error={s.users?.error} onRetry={reload} />
            <Grid cols="2">
                <DepartmentsView loading={loading} data={s.depts?.data} error={s.depts?.error} onRetry={reload} />
                <WorkspacesAccess loading={loading} data={s.workspaces?.data} error={s.workspaces?.error} onRetry={reload} />
            </Grid>
            <AuditSecurity loading={loading} data={s.audit?.data} error={s.audit?.error} onRetry={reload} />
        </DashPage>
    );
};

export default AdminDashboard;
