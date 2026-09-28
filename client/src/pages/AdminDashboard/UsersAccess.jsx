import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, Clock, UserX, UserRound, Mail } from 'lucide-react';
import { Section, KpiGrid, Kpi, Panel, Btn, EmptyState, ErrorState, LoadingState, Avatar, timeAgo } from '../../components/company-dash/dashUi';

/** People KPIs (real counts from /api/admin-dashboard/users-access) + recent pending invites. */
const UsersAccess = ({ data, loading, error, onRetry }) => {
    const navigate = useNavigate();
    const stats = data?.stats;
    const invites = data?.recentInvites || [];

    return (
        <Section
            title="People & access"
            lead="Everyone in the company, by account status."
            action={<Btn size="sm" onClick={() => navigate('/admin/users')}>Manage people</Btn>}
        >
            {error ? (
                <Panel><ErrorState message={error} onRetry={onRetry} /></Panel>
            ) : (
                <>
                    <KpiGrid min={160}>
                        <Kpi loading={loading} label="Total" value={stats?.total} icon={Users} hint="Excludes removed accounts" />
                        <Kpi loading={loading} label="Active" value={stats?.active} icon={UserCheck} tone="success" />
                        <Kpi loading={loading} label="Pending" value={stats?.pending} icon={Clock} tone="muted" hint="Invited, not joined yet" />
                        <Kpi loading={loading} label="Suspended" value={stats ? stats.suspended + (stats.blocked || 0) : undefined} icon={UserX} tone="danger" hint={stats?.blocked ? `${stats.blocked} blocked` : undefined} />
                        <Kpi loading={loading} label="Guests" value={stats?.guests} icon={UserRound} tone="muted" />
                    </KpiGrid>
                    <Panel title="Pending invites · last 7 days" icon={Mail} flush>
                        {loading ? <LoadingState /> : invites.length === 0 ? (
                            <EmptyState
                                title="No pending invites"
                                text="People you invite show up here until they accept."
                                action={<Btn size="sm" onClick={() => navigate('/admin/onboard')}>Invite people</Btn>}
                            />
                        ) : (
                            <div className="cd-list">
                                {invites.map((inv) => (
                                    <div className="cd-list-row" key={inv._id || inv.email}>
                                        <Avatar name={inv.username || inv.email} size="sm" />
                                        <div className="cd-grow">
                                            <div className="cd-cell-title">{inv.username || inv.email}</div>
                                            {inv.username && <div className="cd-cell-sub">{inv.email}</div>}
                                        </div>
                                        <span className="cd-muted" style={{ fontSize: 12 }}>{timeAgo(inv.createdAt)}</span>
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

export default UsersAccess;
