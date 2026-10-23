import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Clock, Gauge, Phone, Sparkles } from 'lucide-react';
import {
    Badge, Button, EmptyState, ErrorState, LoadingState, Notice, PageIntro, Row, Section,
} from '../../pages/settingsTabs/settingsUi';
import { usePlan } from './usePlan';
import { COMING_SOON_LINE, UPGRADE_URL, resetText } from './planLimit';
import './plan.css';

/** Note templates that count towards notes.perTemplate, in the order the picker shows them. */
export const NOTE_TEMPLATE_LABELS = [
    ['meeting', 'Meeting notes'],
    ['projectspec', 'Project spec'],
    ['techdesign', 'Technical design'],
    ['brainstorm', 'Brainstorm'],
    ['sop', 'SOP / process'],
    ['announcement', 'Announcement'],
    ['document', 'Document'],
];

const SCOPE_LABEL = { user: 'you', workspace: 'this workspace' };

/** One progress bar: label, "used of max", at-limit state. */
export function UsageBar({ label, used = 0, max, atLimit, scope, note }) {
    const unlimited = max == null;
    const pct = unlimited || !max ? 0 : Math.min(100, Math.round((used / max) * 100));
    const full = atLimit ?? (!unlimited && used >= max);
    return (
        <div className="pl-usage-row" data-at-limit={full ? 'true' : undefined} data-testid="plan-usage-row">
            <div className="pl-usage-label">
                {label}
                {scope && SCOPE_LABEL[scope] && <span className="pl-usage-scope">· {SCOPE_LABEL[scope]}</span>}
            </div>
            <div className="pl-usage-count">{unlimited ? `${used} · no limit` : `${used} of ${max}`}{full ? ' · limit reached' : ''}</div>
            {!unlimited && (
                <div
                    className="pl-bar"
                    role="progressbar"
                    aria-label={label}
                    aria-valuemin={0}
                    aria-valuemax={max}
                    aria-valuenow={Math.min(used, max)}
                    aria-valuetext={`${used} of ${max}`}
                >
                    <div className="pl-bar-fill" style={{ width: `${pct}%` }} />
                </div>
            )}
            {note && <div className="pl-usage-note">{note}</div>}
        </div>
    );
}

/** What the tab shows for a GET /api/plan body. Presentational (tests render this). */
export function PlanUsageView({ plan, workspaceName, onSeePlans }) {
    if (plan?.exempt) {
        return (
            <Section title="Your plan">
                <div style={{ padding: 16 }}>
                    <Notice tone="success">Your company plan has no free-plan limits.</Notice>
                </div>
            </Section>
        );
    }
    const planName = plan?.plans?.find((p) => p.id === plan.plan)?.name || (plan?.plan === 'free' || !plan?.plan ? 'Free' : plan.plan);
    const items = plan?.items || [];
    const userItems = items.filter((i) => i.scope !== 'workspace' && !i.key.startsWith('ai.'));
    const wsItems = items.filter((i) => i.scope === 'workspace' && !i.key.startsWith('ai.'));
    const aiItems = items.filter((i) => i.key.startsWith('ai.'));
    const perTemplate = plan?.notes?.perTemplate;
    const byTemplate = plan?.notes?.byTemplate || {};
    const reset = resetText(plan?.ai?.resetsAt);

    return (
        <>
            <Section title="Your plan">
                <div style={{ padding: 16 }} className="pl-plan-head">
                    <span className="pl-plan-name" data-testid="plan-name">{planName}</span>
                    <Badge tone="accent">Current plan</Badge>
                    <span className="pl-plan-soon">{COMING_SOON_LINE}</span>
                    <span style={{ marginLeft: 'auto' }}>
                        <Button size="sm" icon={Sparkles} onClick={onSeePlans}>See plans</Button>
                    </span>
                </div>
            </Section>

            {userItems.length > 0 && (
                <Section title="Your account" description="Counts across every workspace.">
                    <div className="pl-usage">{userItems.map((i) => <UsageBar key={i.key} label={i.label} used={i.used} max={i.max} atLimit={i.atLimit} />)}</div>
                </Section>
            )}

            {wsItems.length > 0 && (
                <Section title={workspaceName ? `Workspace · ${workspaceName}` : 'This workspace'}>
                    <div className="pl-usage">{wsItems.map((i) => <UsageBar key={i.key} label={i.label} used={i.used} max={i.max} atLimit={i.atLimit} />)}</div>
                </Section>
            )}

            {aiItems.length > 0 && (
                <Section title="AI today" description={reset ? `Daily AI requests ${reset} (your time).` : 'Daily AI requests reset at midnight UTC.'}>
                    <div className="pl-usage">{aiItems.map((i) => <UsageBar key={i.key} label={i.label} used={i.used} max={i.max} atLimit={i.atLimit} />)}</div>
                </Section>
            )}

            {perTemplate != null && (
                <Section title="Notes from templates" description={`You can create ${perTemplate} notes from each template in a workspace. Blank notes are unlimited.`}>
                    <div className="pl-usage">
                        {NOTE_TEMPLATE_LABELS.map(([id, label]) => (
                            <UsageBar key={id} label={label} used={byTemplate[id] || 0} max={perTemplate} />
                        ))}
                    </div>
                </Section>
            )}

            {plan?.huddles && (
                <Section title="Calls">
                    <Row label="People in one call" description="Huddles and meetings">
                        <span className="pl-usage-count"><Phone size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />{plan.huddles.participants ?? 'No limit'}</span>
                    </Row>
                    <Row label="Length of one call" description="Calls end automatically; notes are kept in the meeting notes.">
                        <span className="pl-usage-count"><Clock size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />{plan.huddles.minutes != null ? `${plan.huddles.minutes} minutes` : 'No limit'}</span>
                    </Row>
                </Section>
            )}
        </>
    );
}

/** Settings → Plan & usage. */
export default function PlanUsageSection({ workspaceId, workspaceName, workspacePicker, embedded = false }) {
    const navigate = useNavigate();
    const { plan, loading, error, refresh } = usePlan(workspaceId || null);
    const seePlans = () => navigate(plan?.upgradeUrl && plan.upgradeUrl.startsWith('/') ? plan.upgradeUrl : UPGRADE_URL);

    return (
        <>
            {!embedded && (
                <PageIntro
                    title="Plan & usage"
                    description="What your plan includes and how much of it you are using."
                />
            )}
            {workspacePicker}
            {loading && !plan ? (
                <LoadingState label="Loading your plan…" />
            ) : error && !plan ? (
                <ErrorState message="Could not load your plan." onRetry={() => refresh(true)} />
            ) : !plan ? (
                <EmptyState icon={Gauge}>No plan information yet.</EmptyState>
            ) : (
                <PlanUsageView plan={plan} workspaceName={workspaceName} onSeePlans={seePlans} />
            )}
            {plan && !plan.exempt && !workspaceId && (
                <EmptyState icon={Building2}>Join or create a workspace to see its channels, members, tasks and AI usage.</EmptyState>
            )}
        </>
    );
}
