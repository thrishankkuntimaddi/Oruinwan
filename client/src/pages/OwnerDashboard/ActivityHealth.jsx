import React from 'react';
import { Zap, ListTodo, Briefcase, Moon } from 'lucide-react';
import { Section, KpiGrid, Kpi, Panel, Meter } from '../../components/company-dash/dashUi';

/**
 * Engagement KPIs from GET /api/owner-dashboard/activity-health.
 * Built from sign-ins, tasks and workspace structure only: messages are end-to-end
 * encrypted, so the owner console never counts them.
 */
const ActivityHealth = ({ data, loading }) => {
    const t = data?.tasks || {};
    const weeklyAvg = t.last30days ? Math.round(t.last30days / 4.3) : 0;
    const trend = t.last7days == null ? null
        : t.last7days > weeklyAvg ? { text: 'above', tone: 'up' }
            : t.last7days < weeklyAvg ? { text: 'below', tone: 'down' } : { text: 'level with', tone: undefined };
    const score = data?.engagementScore;
    const signIns = data?.signIns || {};

    return (
        <Section title="Activity & health" lead="Sign-ins, tasks and workspaces. Message content and volume stay private.">
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
                        {signIns.people ? `${signIns.last7days} of ${signIns.people} people signed in this week` : 'No people yet'}
                    </div>
                </Panel>
                <Kpi
                    label="Tasks · 7 days"
                    icon={ListTodo}
                    value={t.last7days}
                    loading={loading}
                    delta={trend && t.last30days ? trend.text : null}
                    deltaTone={trend?.tone}
                    hint={t.last30days ? `the weekly average (${weeklyAvg.toLocaleString()})` : 'no tasks in the last 30 days'}
                />
                <Kpi
                    label="Active workspaces"
                    icon={Briefcase}
                    tone="success"
                    value={data?.activeWorkspaces}
                    loading={loading}
                    hint="with task activity this week"
                />
                <Kpi
                    label="Quiet workspaces"
                    icon={Moon}
                    tone="muted"
                    value={data?.dormantWorkspaces}
                    loading={loading}
                    hint="no task activity in 7 days"
                />
            </KpiGrid>
        </Section>
    );
};

export default ActivityHealth;
