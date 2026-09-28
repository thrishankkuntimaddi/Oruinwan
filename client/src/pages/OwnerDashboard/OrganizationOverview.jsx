import React from 'react';
import { Users, UserCheck, Briefcase, Building } from 'lucide-react';
import { Section, KpiGrid, Kpi } from '../../components/company-dash/dashUi';

/** Headcount and structure KPIs from GET /api/owner-dashboard/overview. */
const OrganizationOverview = ({ data, loading, onNavigate }) => {
    const growth = data?.growthRate || {};
    return (
        <Section title="Organization" lead="Headcount and structure of your company">
            <KpiGrid>
                <Kpi
                    label="People"
                    icon={Users}
                    value={data?.totalUsers}
                    loading={loading}
                    delta={growth.users ? `+${growth.users}` : null}
                    deltaTone="up"
                    hint={growth.users ? 'joined in the last 30 days' : 'no new joiners in 30 days'}
                    onClick={onNavigate ? () => onNavigate('/owner/users') : undefined}
                />
                <Kpi
                    label="Active accounts"
                    icon={UserCheck}
                    tone="success"
                    value={data?.activeUsers}
                    loading={loading}
                    hint={data?.totalUsers ? `${Math.round(((data.activeUsers || 0) / data.totalUsers) * 100)}% of all accounts` : 'accounts in good standing'}
                />
                <Kpi
                    label="Workspaces"
                    icon={Briefcase}
                    value={data?.workspaceCount}
                    loading={loading}
                    delta={growth.workspaces ? `+${growth.workspaces}` : null}
                    deltaTone="up"
                    hint={growth.workspaces ? 'created in the last 30 days' : 'none created in 30 days'}
                    onClick={onNavigate ? () => onNavigate('/owner/workspaces') : undefined}
                />
                <Kpi
                    label="Departments"
                    icon={Building}
                    value={data?.departmentCount}
                    loading={loading}
                    hint="structural units"
                    onClick={onNavigate ? () => onNavigate('/owner/departments') : undefined}
                />
            </KpiGrid>
        </Section>
    );
};

export default OrganizationOverview;
