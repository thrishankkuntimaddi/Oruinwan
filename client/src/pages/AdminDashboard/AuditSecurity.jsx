import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, UserCog, KeyRound, ClipboardList } from 'lucide-react';
import { Section, KpiGrid, Kpi, Panel, Btn, EmptyState, ErrorState, LoadingState, Avatar, timeAgo } from '../../components/company-dash/dashUi';

/** Last 7 days of audit activity. */
const AuditSecurity = ({ data, loading, error, onRetry }) => {
    const navigate = useNavigate();
    const actions = data?.recentActions || [];

    return (
        <Section
            title="Audit & security · last 7 days"
            lead="Role and permission changes, and the latest audited actions."
            action={(
                <div className="cd-head-actions">
                    <Btn size="sm" icon={ShieldCheck} onClick={() => navigate('/admin/security')}>Security</Btn>
                    <Btn size="sm" icon={ClipboardList} onClick={() => navigate('/admin/audit-logs')}>Full audit log</Btn>
                </div>
            )}
        >
            {error ? <Panel><ErrorState message={error} onRetry={onRetry} /></Panel> : (
                <>
                    <KpiGrid min={180}>
                        <Kpi loading={loading} label="Role changes" value={data?.roleChanges} icon={UserCog} />
                        <Kpi loading={loading} label="Permission changes" value={data?.permissionChanges} icon={KeyRound} tone="muted" />
                        <Kpi loading={loading} label="Audited actions" value={data ? actions.length : undefined} icon={ClipboardList} tone="muted" hint={actions.length >= 50 ? 'Showing the latest 50' : undefined} />
                    </KpiGrid>
                    <Panel title="Recent activity" icon={ClipboardList} flush>
                        {loading ? <LoadingState /> : actions.length === 0 ? (
                            <EmptyState icon={ShieldCheck} title="No audited activity this week" text="Sign-ins, role changes and settings updates will be listed here." />
                        ) : (
                            <div className="cd-list" style={{ maxHeight: 360, overflowY: 'auto' }}>
                                {actions.slice(0, 20).map((a, i) => (
                                    <div className="cd-list-row" key={`${a.timestamp}-${i}`}>
                                        <Avatar name={a.actor} size="sm" />
                                        <div className="cd-grow">
                                            <div className="cd-cell-title" style={{ textTransform: 'capitalize' }}>{(a.action || 'action').replace(/_/g, ' ')}</div>
                                            <div className="cd-cell-sub">{a.description || `By ${a.actor}`}</div>
                                        </div>
                                        <span className="cd-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{timeAgo(a.timestamp)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>
                </>
            )}
        </Section>
    );
};

export default AuditSecurity;
