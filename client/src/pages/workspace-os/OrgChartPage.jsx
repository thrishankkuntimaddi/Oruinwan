import React, { useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Building2, Users, ChevronDown, ChevronRight, RefreshCw, Crown, Briefcase, Network } from 'lucide-react';
import { Avatar, Btn, Chip, KpiGrid, Kpi, Panel, EmptyState, ErrorState, LoadingState } from '../../components/ui/page';
import '../toolkit/toolkit.css';

const toggleStyle = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font)', color: 'inherit' };
const branchStyle = { marginLeft: 18, paddingLeft: 16, borderLeft: '1px solid var(--gl-accent-line)', display: 'flex', flexDirection: 'column', gap: 8 };

const MemberPill = ({ member }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 3px', fontSize: 12, color: 'var(--text-primary)', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--gl-radius)' }}>
        <Avatar name={member.username} src={member.profilePicture} size="sm" />
        <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.username}</span>
        {member.role === 'lead' && <Crown size={11} style={{ color: 'var(--accent)' }} aria-label="Lead" />}
    </span>
);

const TeamCard = ({ team }) => {
    const [expanded, setExpanded] = useState(false);
    const Chevron = expanded ? ChevronDown : ChevronRight;
    return (
        <div className="gl-card" style={{ overflow: 'hidden' }}>
            <button type="button" onClick={() => setExpanded(e => !e)} style={toggleStyle} aria-expanded={expanded}>
                <span className="tk-mark" data-size="sm" data-muted="true"><Users size={14} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--text-primary)' }}>{team.name}</span>
                    <span className="cd-hint">{team.memberCount} member{team.memberCount === 1 ? '' : 's'}</span>
                </span>
                <Chevron size={14} style={{ color: 'var(--text-muted)' }} />
            </button>
            {expanded && team.members?.length > 0 && (
                <div style={{ padding: '0 14px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {team.members.map(m => m.id && <MemberPill key={m.id} member={m} />)}
                </div>
            )}
        </div>
    );
};

const DepartmentNode = ({ dept }) => {
    const [expanded, setExpanded] = useState(true);
    const hasTeams = dept.teams?.length > 0;
    const Chevron = expanded ? ChevronDown : ChevronRight;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="gl-card" style={{ overflow: 'hidden' }}>
                <button type="button" onClick={() => setExpanded(e => !e)} style={{ ...toggleStyle, padding: '14px 16px' }} aria-expanded={expanded}>
                    <span className="tk-mark"><Building2 size={17} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{dept.name}</span>
                        <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2, fontSize: 12, color: 'var(--text-secondary)' }}>
                            <span>{dept.memberCount} member{dept.memberCount === 1 ? '' : 's'}</span>
                            {dept.head && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Crown size={11} style={{ color: 'var(--accent)' }} />{dept.head.username}</span>}
                        </span>
                    </span>
                    <Chevron size={16} style={{ color: 'var(--text-muted)' }} />
                </button>
                {expanded && dept.managers?.length > 0 && (
                    <div style={{ padding: '0 16px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {dept.managers.map(mgr => <Chip key={mgr._id} tone="accent"><Briefcase size={11} />{mgr.username}</Chip>)}
                    </div>
                )}
            </div>
            {expanded && hasTeams && (
                <div style={branchStyle}>
                    {dept.teams.map(team => <TeamCard key={team.id} team={team} />)}
                </div>
            )}
        </div>
    );
};

/** Company org chart: departments, their heads and managers, and the teams inside them. */
export default function OrgChartPage({ companyId }) {
    const { user } = useAuth();
    const rawCompanyId = companyId || user?.companyId;

    const resolvedCompanyId = typeof rawCompanyId === 'object' && rawCompanyId !== null
        ? (rawCompanyId._id || rawCompanyId.id || String(rawCompanyId))
        : rawCompanyId;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!resolvedCompanyId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/api/companies/${resolvedCompanyId}/org-chart`);
            setData(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Could not load the org chart');
        } finally {
            setLoading(false);
        }
    }, [resolvedCompanyId]);

    useEffect(() => { load(); }, [load]);

    if (loading && !data) return <LoadingState label="Loading org chart…" />;
    if (error) return <ErrorState message={error} onRetry={load} />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    {data?.company?.logo
                        ? <img src={data.company.logo} alt="" className="tk-mark" style={{ width: 44, height: 44, objectFit: 'contain', padding: 4 }} />
                        : <span className="tk-mark" style={{ width: 44, height: 44 }}><Network size={20} /></span>}
                    <div style={{ minWidth: 0 }}>
                        <h2 className="cd-section-title" style={{ fontSize: 16 }}>{data?.company?.name || 'Organisation'}</h2>
                        <p className="cd-section-lead">Who works where: departments, their leads and the teams inside them.</p>
                    </div>
                </div>
                <Btn variant="ghost" icon={RefreshCw} loading={loading} onClick={load}>Refresh</Btn>
            </div>

            {data && (
                <KpiGrid min={150}>
                    <Kpi label="People" value={data.totalEmployees} icon={Users} />
                    <Kpi label="Departments" value={data.departments?.length ?? 0} icon={Building2} />
                    <Kpi label="Not in a department" value={data.unassignedCount ?? 0} icon={Users} tone={data.unassignedCount ? undefined : 'muted'} />
                </KpiGrid>
            )}

            {data?.departments?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {data.departments.map(dept => <DepartmentNode key={dept.id} dept={dept} />)}
                </div>
            ) : (
                <Panel>
                    <EmptyState icon={Building2} title="No departments yet" text="Create departments to see your organisation take shape here." />
                </Panel>
            )}
        </div>
    );
}
