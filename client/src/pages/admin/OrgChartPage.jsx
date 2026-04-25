import React, { useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { GitBranch, RefreshCw, ChevronDown, ChevronRight, Users } from 'lucide-react';

function OrgNode({ node, color, depth = 0 }) {
    const [expanded, setExpanded] = useState(depth < 2);
    const hasChildren = (node.teams && node.teams.length > 0) || (node.children && node.children.length > 0);

    return (
        <div style={{ marginLeft: depth === 0 ? 0 : 20, position: 'relative' }}>
            {depth > 0 && (
                <div style={{ position: 'absolute', left: -12, top: 20, width: 12, height: 1, background: 'var(--border-accent)' }} />
            )}
            <div
                style={{ background: 'var(--bg-surface)', border: `1px solid ${color}`, padding: '10px 14px', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: hasChildren ? 'pointer' : 'default', minWidth: '160px', userSelect: 'none', transition: 'border-color 150ms ease' }}
                onClick={() => hasChildren && setExpanded(e => !e)}
                onMouseEnter={e => { if (hasChildren) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; }}>
                <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1px' }}>{node.name}</p>
                    {node.memberCount !== undefined && <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{node.memberCount} members</p>}
                    {node.lead && <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Lead: {node.lead.username}</p>}
                </div>
                {hasChildren && (
                    <div style={{ marginLeft: 'auto', color, flexShrink: 0 }}>
                        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </div>
                )}
            </div>

            {expanded && hasChildren && (
                <div style={{ marginTop: '8px', paddingLeft: '20px', borderLeft: `1px dashed ${color}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(node.teams || []).map((team, ti) => (
                        <OrgNode key={team.id} node={team} color={NODE_COLORS[(ti + 3) % NODE_COLORS.length]} depth={depth + 1} />
                    ))}
                    {(node.children || []).map((child, ci) => (
                        <OrgNode key={child.id} node={child} color={NODE_COLORS[(ci + 1) % NODE_COLORS.length]} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}

const NODE_COLORS = ['var(--accent)', '#5aba8a', '#9b8ecf', '#e05252', '#7a7a7a', '#b8956a', '#5ab8ba', '#ba5a8a'];

export default function OrgChartPage() {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const companyId = typeof user?.companyId === 'object' ? (user?.companyId?._id || user?.companyId?.id) : user?.companyId;

    const fetchOrgChart = useCallback(async () => {
        if (!companyId) { setError('No company found. Org chart is available for company accounts only.'); setLoading(false); return; }
        try {
            setLoading(true); setError(null);
            const { data: orgData } = await api.get(`/api/companies/${companyId}/org-chart`);
            setData(orgData);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load org chart');
        } finally { setLoading(false); }
    }, [companyId]);

    useEffect(() => { fetchOrgChart(); }, [fetchOrgChart]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {}
            <header style={{ height: '56px', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, zIndex: 5 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <GitBranch size={16} style={{ color: 'var(--accent)' }} />
                        Org Chart
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>
                        {data ? `${data.company?.name} · ${data.totalEmployees} employees · ${data.departments?.length} departments` : 'Company structure visualization'}
                    </p>
                </div>
                <button onClick={fetchOrgChart}
                    style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
                    <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                </button>
            </header>

            {}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }} className="custom-scrollbar">
                {loading && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
                    <RefreshCw size={22} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} /></div>}

                {error && <div style={{ padding: '12px 16px', background: 'rgba(224,82,82,0.08)', border: '1px solid var(--state-danger)', color: 'var(--state-danger)', fontSize: '12px', marginBottom: '16px' }}>{error}</div>}

                {data && !loading && (
                    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border-subtle)' }}>
                            {[
                                { label: 'Total Employees', value: data.totalEmployees },
                                { label: 'Departments', value: data.departments?.length || 0 },
                                { label: 'Unassigned', value: data.unassignedCount || 0, warn: data.unassignedCount > 0 },
                            ].map(stat => (
                                <div key={stat.label} style={{ background: 'var(--bg-surface)', padding: '18px 20px' }}>
                                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>{stat.label}</p>
                                    <p style={{ fontSize: '28px', fontWeight: 700, color: stat.warn && stat.value > 0 ? 'var(--accent)' : 'var(--text-primary)', letterSpacing: '-0.02em' }}>{stat.value}</p>
                                </div>
                            ))}
                        </div>

                        {}
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '24px' }}>
                            {}
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', background: 'var(--accent)', padding: '12px 20px', marginBottom: '24px' }}>
                                <Users size={18} style={{ color: 'var(--bg-base)' }} />
                                <div>
                                    <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--bg-base)', marginBottom: '1px' }}>{data.company?.name}</p>
                                    <p style={{ fontSize: '11px', color: 'rgba(12,12,12,0.7)' }}>{data.company?.industry || 'Company'}</p>
                                </div>
                            </div>

                            {data.departments?.length === 0
                                ? <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No departments found. Add departments from the Departments page.</p>
                                : <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {(data.departments || []).map((dept, idx) => (
                                        <OrgNode key={dept.id} node={dept} color={NODE_COLORS[idx % NODE_COLORS.length]} depth={1} />
                                    ))}
                                </div>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
