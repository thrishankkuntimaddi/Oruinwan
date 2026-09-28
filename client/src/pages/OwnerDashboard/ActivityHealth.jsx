import React from 'react';
import { Zap, MessageSquare, Briefcase, Moon } from 'lucide-react';
import { Section, KpiGrid, Kpi, Panel, Meter } from '../../components/company-dash/dashUi';

/** Engagement KPIs from GET /api/owner-dashboard/activity-health. */
const ActivityHealth = ({ data, loading }) => {
    const m = data?.messages || {};
    const weeklyAvg = m.last30days ? Math.round(m.last30days / 4.3) : 0;
    const trend = m.last7days == null ? null
        : m.last7days > weeklyAvg ? { text: 'above', tone: 'up' }
            : m.last7days < weeklyAvg ? { text: 'below', tone: 'down' } : { text: 'level with', tone: undefined };
    const score = data?.engagementScore;
    const total = (data?.activeWorkspaces || 0) + (data?.dormantWorkspaces || 0);

    return (
        <Section title="Activity & health" lead="How much your workspaces are actually used">
            <KpiGrid>
                <Panel>
                    <div className="cd-kpi-top" style={{ marginBottom: 6 }}>
                        <span className="cd-kpi-label">Engagement</span>
                        <span className="cd-kpi-icon"><Zap size={14} /></span>
                    </div>
                    <div className="cd-kpi-value" style={{ marginBottom: 10 }}>
                        {loading ? '…' : score == null ? '—' : `${score}%`}
                    </div>
                    <Meter value={score || 0} label="Engagement score" tone={score >= 60 ? 'success' : score < 25 ? 'danger' : undefined} />
                    <div className="cd-kpi-hint" style={{ marginTop: 8 }}>
                        {total ? `${data.activeWorkspaces} of ${total} workspaces had messages this week` : 'No workspaces yet'}
                    </div>
                </Panel>
                <Kpi
                    label="Messages · 7 days"
                    icon={MessageSquare}
                    value={m.last7days}
                    loading={loading}
                    delta={trend && m.last30days ? trend.text : null}
                    deltaTone={trend?.tone}
                    hint={m.last30days ? `the weekly average (${weeklyAvg.toLocaleString()})` : 'no messages in the last 30 days'}
                />
                <Kpi
                    label="Active workspaces"
                    icon={Briefcase}
                    tone="success"
                    value={data?.activeWorkspaces}
                    loading={loading}
                    hint="with messages this week"
                />
                <Kpi
                    label="Dormant workspaces"
                    icon={Moon}
                    tone="muted"
                    value={data?.dormantWorkspaces}
                    loading={loading}
                    hint="no messages in 7 days"
                />
            </KpiGrid>
        </Section>
    );
};

export default ActivityHealth;
