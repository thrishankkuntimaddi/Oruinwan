// TeamAllocation — Monolith Flow Design System
import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, Briefcase, CheckCircle2, Clock, Users } from 'lucide-react';
import api from '@services/api';

const inputSt = { background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', padding: '8px 12px', width: '100%', boxSizing: 'border-box' };

const utilizColor = (v) => { if (v > 90) return 'var(--state-danger)'; if (v > 75) return 'var(--accent)'; return 'var(--state-success)'; };
const utilizLabel = (v) => { if (v > 90) return 'OVERLOAD'; if (v < 50) return 'AVAILABLE'; return 'OPTIMAL'; };

export default function TeamAllocation() {
    const { selectedDepartment } = useOutletContext();
    const [teamData, setTeamData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchTeam = async () => {
            try {
                setLoading(true);
                const res = await api.get('/api/manager-dashboard/team-load');
                const members = (res.data.teamMembers || []).map(m => ({
                    ...m, project: m.project || 'Main Product',
                    utilization: Math.floor(Math.random() * 40) + 60,
                    tasksCompleted: Math.floor(Math.random() * 20),
                    tasksPending: Math.floor(Math.random() * 10)
                }));
                setTeamData({ members, overloaded: res.data.overloaded || [], idle: res.data.idle || [] });
            } catch {
                setTeamData({ members: [], overloaded: [], idle: [] });
            } finally { setLoading(false); }
        };
        fetchTeam();
    }, [selectedDepartment]);

    const members = (teamData?.members || []).filter(m =>
        m.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.project?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const TH_ST = { padding: '10px 16px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', textAlign: 'left', background: 'var(--bg-active)', borderBottom: '1px solid var(--border-subtle)' };
    const TD_ST = { padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <header style={{ height: '56px', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Users size={16} style={{ color: 'var(--accent)' }} /> Resource Allocation
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>Manage project assignments and team workload</p>
                </div>
            </header>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }} className="custom-scrollbar">
                {/* Search */}
                <div style={{ position: 'relative', maxWidth: '480px', marginBottom: '16px' }}>
                    <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input type="text" placeholder="Search by name, email or project..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        style={{ ...inputSt, paddingLeft: '30px' }} />
                </div>

                {loading
                    ? <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ height: '56px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div><div className="sk" style={{ height: '13px', width: '180px', marginBottom: '5px' }} /><div className="sk" style={{ height: '9px', width: '280px' }} /></div>
            </div>
            <div style={{ flex: 1, padding: '20px 28px' }}>
                {/* Search skeleton */}
                <div className="sk" style={{ height: '32px', width: '320px', marginBottom: '16px' }} />
                {/* Table */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    {/* thead */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1.5fr', background: 'var(--bg-active)', borderBottom: '1px solid var(--border-subtle)', padding: '10px 16px', gap: '16px' }}>
                        {[90, 100, 70, 90].map((w,i) => <div key={i} className="sk" style={{ height: '9px', width: `${w}px` }} />)}
                    </div>
                    {/* rows */}
                    {[1,2,3,4,5].map(i => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1.5fr', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', gap: '16px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="sk" style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0 }} />
                                <div><div className="sk" style={{ height: '11px', width: '100px', marginBottom: '4px' }} /><div className="sk" style={{ height: '9px', width: '60px' }} /></div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div className="sk" style={{ width: '12px', height: '12px' }} />
                                <div className="sk" style={{ height: '11px', width: '120px' }} />
                            </div>
                            <div><div className="sk" style={{ height: '4px', width: '100%', marginBottom: '6px' }} /><div style={{ display: 'flex', justifyContent: 'space-between' }}><div className="sk" style={{ height: '9px', width: '30px' }} /><div className="sk" style={{ height: '9px', width: '55px' }} /></div></div>
                            <div style={{ display: 'flex', gap: '8px' }}><div className="sk" style={{ height: '9px', width: '50px' }} /><div className="sk" style={{ height: '9px', width: '60px' }} /></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
                    : (
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        {['Resource', 'Current Project', 'Utilization', 'Task Status'].map(h => (
                                            <th key={h} style={TH_ST}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {members.map(m => {
                                        const uColor = utilizColor(m.utilization);
                                        return (
                                            <tr key={m._id} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                <td style={TD_ST}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(184,149,106,0.1)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                                                            {m.username?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1px' }}>{m.username}</p>
                                                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{m.companyRole}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={TD_ST}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Briefcase size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{m.project || 'Unassigned'}</span>
                                                    </div>
                                                </td>
                                                <td style={TD_ST}>
                                                    <div style={{ width: '120px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                            <span style={{ fontSize: '11px', fontWeight: 600, color: uColor }}>{m.utilization}%</span>
                                                            <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: uColor }}>{utilizLabel(m.utilization)}</span>
                                                        </div>
                                                        <div style={{ height: '4px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${m.utilization}%`, background: uColor, transition: 'width 400ms ease' }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={TD_ST}>
                                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: 'var(--state-success)' }}>
                                                            <CheckCircle2 size={12} /> {m.tasksCompleted} Done
                                                        </span>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: 'var(--accent)' }}>
                                                            <Clock size={12} /> {m.tasksPending} Pending
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {members.length === 0 && (
                                        <tr><td colSpan={4} style={{ padding: '48px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                                            No resources found{searchQuery ? ` matching "${searchQuery}"` : ''}
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
            </div>
        </div>
    );
}
