import React from 'react';
import { Activity, AlertTriangle, FileText, AtSign } from 'lucide-react';
import { Section, KpiGrid, Kpi, Btn } from '../../components/company-dash/dashUi';

/** Security snapshot from GET /api/owner-dashboard/security-risk (real counts only). */
const SecurityRisk = ({ data, loading, error, onOpen }) => {
    const audit = data?.auditSummary || {};
    return (
        <Section
            title="Security snapshot"
            lead={error ? `Could not load security data: ${error}` : 'Sign-ins and sensitive changes over the last week'}
            action={onOpen ? <Btn size="sm" variant="ghost" onClick={onOpen}>Open security</Btn> : null}
        >
            <KpiGrid>
                <Kpi label="Signed in · 24h" icon={Activity} value={data?.activeSessions} loading={loading} hint="people who logged in today" />
                <Kpi
                    label="Critical actions"
                    icon={AlertTriangle}
                    tone={audit.critical ? 'danger' : 'muted'}
                    value={audit.critical}
                    loading={loading}
                    hint="suspensions, removals, role changes · 7 days"
                />
                <Kpi label="Audit events" icon={FileText} value={audit.lastWeek} loading={loading} hint="recorded in the last 7 days" />
                <Kpi
                    label="Email domain"
                    icon={AtSign}
                    tone={data?.emailDomain ? 'success' : 'muted'}
                    value={loading ? undefined : <span style={{ fontSize: 17, overflowWrap: 'anywhere' }}>{data?.emailDomain ? `@${data.emailDomain}` : 'Not set'}</span>}
                    loading={loading}
                    hint={data?.emailDomain ? 'company domain on record' : 'add one in company settings'}
                />
            </KpiGrid>
        </Section>
    );
};

export default SecurityRisk;
