import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Crown, ArrowRight, BarChart2, CreditCard, Lock, ShieldCheck, Users, ClipboardList } from 'lucide-react';

import OrganizationOverview from './OrganizationOverview';
import ActivityHealth from './ActivityHealth';
import SecurityRisk from './SecurityRisk';
import { getOwnerOverview, getActivityHealth, getSecurityRisk } from '../../services/ownerDashboardService';
import { useFlag } from '../../contexts/FeatureFlagsContext';
import { DashPage, PageHead, Section, Grid, Btn, ErrorState, useAsync } from '../../components/company-dash/dashUi';

const LINKS = [
    { title: 'Analytics', text: 'Growth, messages and department mix over time', to: '/owner/analytics', icon: BarChart2 },
    { title: 'Security & risk', text: 'Sessions, security events and settings', to: '/owner/security', icon: Lock },
    { title: 'Admins', text: 'Who can manage your company', to: '/owner/admins', icon: ShieldCheck },
    { title: 'People', text: 'Roles, departments and account status', to: '/owner/users', icon: Users },
    { title: 'Audit logs', text: 'Every administrative change, searchable', to: '/owner/audit-logs', icon: ClipboardList },
    { title: 'Billing & plan', text: 'Plan, seats and invoices', to: '/owner/billing', icon: CreditCard, flag: 'billing' },
];

/** Owner console home: real company metrics only. */
const OwnerDashboard = () => {
    const navigate = useNavigate();
    const billingEnabled = useFlag('billing');
    const [refreshing, setRefreshing] = useState(false);

    const overview = useAsync(() => getOwnerOverview(), []);
    const activity = useAsync(() => getActivityHealth(), []);
    const security = useAsync(() => getSecurityRisk(), []);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([overview.reload(), activity.reload(), security.reload()]);
        setRefreshing(false);
    }, [overview, activity, security]);

    const failed = overview.error && activity.error;

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Owner console"
                    icon={Crown}
                    title="Company overview"
                    lead="Strategic health and growth of your organization"
                    actions={<Btn icon={RefreshCw} loading={refreshing} onClick={refresh}>Refresh</Btn>}
                />
            )}
        >
            {failed ? (
                <ErrorState message={overview.error} onRetry={refresh} />
            ) : (
                <>
                    <OrganizationOverview data={overview.data} loading={overview.loading} onNavigate={navigate} />
                    <ActivityHealth data={activity.data} loading={activity.loading} />
                    <SecurityRisk data={security.data} loading={security.loading} error={security.error} onOpen={() => navigate('/owner/security')} />
                    <Section title="Go deeper" lead="Detailed views and management">
                        <Grid cols="3">
                            {LINKS.filter((l) => !l.flag || (l.flag === 'billing' && billingEnabled)).map((l) => (
                                <button
                                    key={l.to}
                                    type="button"
                                    className="gl-card gl-card--interactive cd-panel"
                                    onClick={() => navigate(l.to)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', font: 'inherit', color: 'inherit' }}
                                >
                                    <span className="cd-kpi-icon"><l.icon size={14} /></span>
                                    <span style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 650, color: 'var(--text-primary)' }}>{l.title}</span>
                                        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{l.text}</span>
                                    </span>
                                    <ArrowRight size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                                </button>
                            ))}
                        </Grid>
                    </Section>
                </>
            )}
        </DashPage>
    );
};

export default OwnerDashboard;
