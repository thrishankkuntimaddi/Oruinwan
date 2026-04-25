import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Globe, Users, Calendar, MoreVertical, Plus, Search, Filter, Rocket, Briefcase, Zap, Palette, Trophy, Target, Flame, Microscope, Shield, Lightbulb, Sparkles, UserPlus, EyeOff } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '@services/api';
import CreateWorkspaceModal from '../workspaceSelectComponents/CreateWorkspaceModal';
import WorkspaceMembersModal from './WorkspaceMembersModal';
import { usePermissions } from '../../hooks/usePermissions';

const ICON_MAP = { rocket: Rocket, briefcase: Briefcase, zap: Zap, palette: Palette, globe: Globe, trophy: Trophy, target: Target, flame: Flame, microscope: Microscope, shield: Shield, lightbulb: Lightbulb, sparkles: Sparkles };
function getIconComponent(name) { return ICON_MAP[name] || Globe; }

const DEFAULT_CREATE_DATA = { name: '', rules: '', icon: 'rocket', color: '#b8956a', invites: '' };

const inputSt = {
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif', padding: '8px 12px',
};

const WorkspacesManagement = () => {
    const { showToast } = useToast();
    const { user } = useAuth();
    const { canManageWorkspace } = usePermissions();
    const [workspaces, setWorkspaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [modalOpen, setModalOpen] = useState(false);
    const [createStep, setCreateStep] = useState(1);
    const [createData, setCreateData] = useState(DEFAULT_CREATE_DATA);
    const [nameError, setNameError] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [creating, setCreating] = useState(false);
    const [openMenuId, setOpenMenuId] = useState(null);
    const menuRef = useRef(null);
    const [membersWorkspace, setMembersWorkspace] = useState(null);

    useEffect(() => {
        const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchWorkspaces = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/admin-dashboard/workspaces');
            setWorkspaces(response.data.workspaces || []);
        } catch (error) {
            showToast('Failed to load workspaces', 'error');
            setWorkspaces([]);
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

    const handleOpenModal = () => { setCreateStep(1); setCreateData(DEFAULT_CREATE_DATA); setNameError(''); setTermsAccepted(false); setModalOpen(true); };
    const handleCloseModal = () => { setModalOpen(false); setTimeout(() => { setCreateStep(1); setCreateData(DEFAULT_CREATE_DATA); setNameError(''); setTermsAccepted(false); }, 300); };

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (creating) return;
        if (!createData.name.trim()) { setNameError('Workspace name is required'); setCreateStep(1); return; }
        try {
            setCreating(true);
            await api.post('/api/workspaces', {
                name: createData.name.trim(), description: createData.rules?.trim() || '',
                icon: createData.icon, color: createData.color, type: 'general',
                settings: { isPrivate: false, allowMemberInvite: true },
            });
            showToast(`Workspace "${createData.name.trim()}" created!`, 'success');
            handleCloseModal();
            fetchWorkspaces();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to create workspace', 'error');
        } finally {
            setCreating(false);
        }
    };

    const filteredWorkspaces = workspaces.filter(w =>
        (w.name.toLowerCase().includes(searchTerm.toLowerCase()) || w.description?.toLowerCase().includes(searchTerm.toLowerCase()))
        && (filterStatus === 'all' || w.status === filterStatus)
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            <header style={{ height: '56px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', flexShrink: 0 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1px' }}>Workspaces Management</h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{canManageWorkspace ? 'Manage all company workspaces' : 'View-only — contact an admin to make changes'}</p>
                </div>
                {canManageWorkspace ? (
                    <CreateBtn onClick={handleOpenModal} label="Create Workspace" icon={Plus} />
                ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                        <EyeOff size={12} /> View Only
                    </span>
                )}
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }} className="custom-scrollbar">
                {}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input type="text" placeholder="Search workspaces..." value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ ...inputSt, width: '100%', paddingLeft: '30px', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Filter size={13} style={{ color: 'var(--text-muted)' }} />
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputSt}>
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                </div>

                {}
                {loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                        {[1,2,3].map(i => (
                            <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderTop: '2px solid var(--border-accent)' }}>
                                <div style={{ padding: '16px 18px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                        <div><div className="sk" style={{ height: '13px', width: '140px', marginBottom: '5px' }} /><div className="sk" style={{ height: '9px', width: '100px' }} /></div>
                                        <div className="sk" style={{ height: '18px', width: '60px' }} />
                                    </div>
                                    <div className="sk" style={{ height: '9px', width: '90%', marginBottom: '3px' }} />
                                    <div className="sk" style={{ height: '9px', width: '70%', marginBottom: '14px' }} />
                                    <div style={{ display: 'flex', gap: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                                        {[1,2,3].map(j => <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div className="sk" style={{ width: '11px', height: '11px' }} /><div className="sk" style={{ height: '9px', width: '40px' }} /></div>)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredWorkspaces.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                        <Globe size={32} style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto 10px' }} />
                        <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>No workspaces found</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>{searchTerm ? 'Try a different search term' : 'Create your first workspace to get started'}</p>
                        {!searchTerm && <CreateBtn onClick={handleOpenModal} label="Create Workspace" icon={Plus} />}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {filteredWorkspaces.map(ws => {
                            const IconCmp = getIconComponent(ws.icon);
                            return (
                                <div key={ws._id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '16px', transition: 'border-color 150ms ease', cursor: 'default' }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '36px', height: '36px', background: ws.color || 'var(--bg-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <IconCmp size={18} style={{ color: 'white' }} />
                                            </div>
                                            <div>
                                                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>{ws.name}</h3>
                                                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: ws.status === 'active' ? 'var(--state-success)' : 'var(--text-muted)', border: `1px solid ${ws.status === 'active' ? 'var(--state-success)' : 'var(--border-default)'}`, padding: '1px 5px' }}>
                                                    {ws.status || 'active'}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ position: 'relative' }} ref={openMenuId === ws._id ? menuRef : null}>
                                            <button onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === ws._id ? null : ws._id); }}
                                                style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                                <MoreVertical size={14} />
                                            </button>
                                            {openMenuId === ws._id && (
                                                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', width: '160px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', zIndex: 50 }}>
                                                    {canManageWorkspace ? (
                                                        <button onClick={e => { e.stopPropagation(); setMembersWorkspace(ws); setOpenMenuId(null); }}
                                                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', textAlign: 'left', transition: 'all 150ms ease' }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                                                            <UserPlus size={13} /> Manage Members
                                                        </button>
                                                    ) : (
                                                        <p style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>No actions available</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {ws.description || 'No description'}
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Users size={12} /> {ws.memberCount ?? ws.members?.length ?? 0} members
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Globe size={12} /> {ws.channelCount ?? 0} channels
                                        </div>
                                    </div>
                                    <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Calendar size={11} /> Created {new Date(ws.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <CreateWorkspaceModal isOpen={modalOpen} onClose={handleCloseModal} createStep={createStep} setCreateStep={setCreateStep} createData={createData} setCreateData={setCreateData} nameError={nameError} setNameError={setNameError} termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} onSubmit={handleSubmit} getIconComponent={getIconComponent} user={user} />
            {membersWorkspace && (
                <WorkspaceMembersModal workspace={membersWorkspace} onClose={() => setMembersWorkspace(null)}
                    onMemberCountChange={count => setWorkspaces(prev => prev.map(w => String(w._id) === String(membersWorkspace._id) ? { ...w, memberCount: count } : w))} />
            )}
        </div>
    );
};

const CreateBtn = ({ onClick, label, icon: Icon }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: hov ? 'var(--accent-hover)' : 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'background 150ms ease' }}>
            <Icon size={13} /> {label}
        </button>
    );
};

export default WorkspacesManagement;
