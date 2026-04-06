// UnassignedMembers — Monolith Flow Design System
import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UserPlus, Search, AlertTriangle, CheckCircle2, Briefcase } from 'lucide-react';
import { getUnassignedEmployees } from '../../services/managerDashboardService';

const inputSt = { background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', padding: '8px 12px', width: '100%', boxSizing: 'border-box' };
const TH_ST = { padding: '10px 16px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', textAlign: 'left', background: 'var(--bg-active)', borderBottom: '1px solid var(--border-subtle)' };
const TD_ST = { padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' };

export default function UnassignedMembers() {
    const { selectedDepartment } = useOutletContext();
    const [unassigned, setUnassigned] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        setLoading(true);
        getUnassignedEmployees()
            .then(r => setUnassigned(r.unassigned || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [selectedDepartment]);

    const filtered = unassigned.filter(m =>
        m.username?.toLowerCase().includes(search.toLowerCase()) ||
        m.email?.toLowerCase().includes(search.toLowerCase())
    );

    // ── Loading skeleton ─────────────────────────────────────────
    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ height: '56px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '0 28px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div><div className="sk" style={{ height: '13px', width: '180px', marginBottom: '5px' }} /><div className="sk" style={{ height: '9px', width: '240px' }} /></div>
            </div>
            <div style={{ flex: 1, padding: '20px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                    <div className="sk" style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}><div className="sk" style={{ height: '10px', width: '100px', marginBottom: '4px' }} /><div className="sk" style={{ height: '9px', width: '340px' }} /></div>
                </div>
                <div className="sk" style={{ height: '32px', width: '320px', marginBottom: '16px' }} />
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', background: 'var(--bg-active)', borderBottom: '1px solid var(--border-subtle)', padding: '10px 16px', gap: '16px' }}>
                        {[70, 100, 55, 65].map((w, i) => <div key={i} className="sk" style={{ height: '9px', width: `${w}px` }} />)}
                    </div>
                    {[1,2,3,4].map(i => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', gap: '16px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="sk" style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0 }} />
                                <div><div className="sk" style={{ height: '11px', width: '100px', marginBottom: '4px' }} /><div className="sk" style={{ height: '9px', width: '130px' }} /></div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}><div className="sk" style={{ height: '18px', width: '60px' }} /><div className="sk" style={{ height: '18px', width: '70px' }} /></div>
                            <div className="sk" style={{ height: '18px', width: '70px' }} />
                            <div className="sk" style={{ height: '28px', width: '72px' }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <header style={{ height: '56px', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <UserPlus size={16} style={{ color: 'var(--accent)' }} /> Unassigned Members
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>Employees needing workspace assignment</p>
                </div>
            </header>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }} className="custom-scrollbar">
                {/* Alert banner */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: unassigned.length > 0 ? 'rgba(184,149,106,0.06)' : 'rgba(90,186,138,0.06)', border: `1px solid ${unassigned.length > 0 ? 'var(--accent)' : 'var(--state-success)'}`, marginBottom: '16px' }}>
                    {unassigned.length > 0
                        ? <AlertTriangle size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        : <CheckCircle2 size={16} style={{ color: 'var(--state-success)', flexShrink: 0 }} />}
                    <div>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: unassigned.length > 0 ? 'var(--accent)' : 'var(--state-success)', marginBottom: '1px' }}>
                            {unassigned.length > 0 ? 'Action Required' : 'All Clear'}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {unassigned.length > 0
                                ? `${unassigned.length} team member${unassigned.length > 1 ? 's' : ''} not assigned to any workspace.`
                                : 'All team members are currently assigned to workspaces.'}
                        </p>
                    </div>
                </div>

                {/* Search */}
                <div style={{ position: 'relative', maxWidth: '480px', marginBottom: '16px' }}>
                    <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input type="text" placeholder="Search unassigned members..." value={search} onChange={e => setSearch(e.target.value)}
                        style={{ ...inputSt, paddingLeft: '30px' }} />
                </div>

                {/* Table */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['Member', 'Departments', 'Status', 'Actions'].map(h => <th key={h} style={TH_ST}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(m => (
                                <tr key={m._id} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <td style={TD_ST}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                                                {m.username?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1px' }}>{m.username}</p>
                                                <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{m.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={TD_ST}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {m.departments?.map((d, i) => (
                                                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 600, padding: '2px 7px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                                                    <Briefcase size={9} />{d.name}
                                                </span>
                                            )) || <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No Department</span>}
                                        </div>
                                    </td>
                                    <td style={TD_ST}>
                                        <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 7px', border: '1px solid var(--accent)', color: 'var(--accent)' }}>Unassigned</span>
                                    </td>
                                    <td style={TD_ST}>
                                        <AssignBtn />
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={4} style={{ padding: '48px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                                    {search ? `No members matching "${search}".` : 'No unassigned members found.'}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

const AssignBtn = () => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', background: hov ? 'var(--accent)' : 'var(--bg-active)', border: '1px solid var(--border-default)', color: hov ? 'var(--bg-base)' : 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 150ms ease' }}>
            <UserPlus size={11} /> Assign
        </button>
    );
};
