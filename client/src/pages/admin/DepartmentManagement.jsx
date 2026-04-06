import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Users, Search, Edit, Trash2, MessageCircle } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { useNavigate } from 'react-router-dom';
import DepartmentModal from '../../components/company/DepartmentModal';
import DepartmentDetailsModal from '../../components/company/DepartmentDetailsModal';
import { getDepartments, deleteDepartment } from '../../services/departmentService';

const inputSt = {
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif', padding: '8px 12px',
};

const DepartmentManagement = () => {
    const { company } = useCompany();
    const navigate = useNavigate();
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDept, setSelectedDept] = useState(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [viewDepartment, setViewDepartment] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchDepartments = useCallback(async () => {
        if (!company?._id) return;
        try {
            setLoading(true);
            const res = await getDepartments(company._id);
            setDepartments(res.departments || []);
        } catch (err) {
            console.error('Failed to fetch departments', err);
        } finally {
            setLoading(false);
        }
    }, [company?._id]);

    useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

    const handleCreate = () => { setSelectedDept(null); setIsModalOpen(true); };
    const handleEdit = (dept) => { setSelectedDept(dept); setIsModalOpen(true); };
    const handleDelete = async (deptId) => {
        if (window.confirm('Are you sure you want to delete this department?')) {
            try { await deleteDepartment(deptId); fetchDepartments(); }
            catch { alert('Failed to delete department'); }
        }
    };
    const handleRowClick = (dept) => { setViewDepartment(dept); setIsDetailsOpen(true); };
    const filteredDepartments = departments.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <React.Fragment>
            <header style={{ height: '56px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', flexShrink: 0 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1px' }}>Departments</h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Structure & Access</p>
                </div>
                <CreateBtn onClick={handleCreate} />
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }} className="custom-scrollbar">
                <div style={{ position: 'relative', marginBottom: '14px', maxWidth: '320px' }}>
                    <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input type="text" placeholder="Search departments..." value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ ...inputSt, width: '100%', paddingLeft: '30px', boxSizing: 'border-box' }} />
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-active)', borderBottom: '1px solid var(--border-subtle)' }}>
                                {['Name', 'Head', 'Members', 'Created', 'Actions'].map((h, i) => (
                                    <th key={h} style={{ padding: '10px 16px', textAlign: i === 4 ? 'right' : 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <>
                                    {[1,2,3,4].map(i => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div className="sk" style={{ height: '12px', width: '140px', marginBottom: '4px' }} />
                                                <div className="sk" style={{ height: '9px', width: '100px' }} />
                                            </td>
                                            <td style={{ padding: '12px 16px' }}><div className="sk" style={{ height: '20px', width: '80px' }} /></td>
                                            <td style={{ padding: '12px 16px' }}><div className="sk" style={{ height: '9px', width: '30px' }} /></td>
                                            <td style={{ padding: '12px 16px' }}><div className="sk" style={{ height: '9px', width: '80px' }} /></td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                    <div className="sk" style={{ height: '26px', width: '26px' }} />
                                                    <div className="sk" style={{ height: '26px', width: '26px' }} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </>
                            ) : filteredDepartments.length === 0 ? (
                                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '32px', fontSize: '13px', color: 'var(--text-muted)' }}>No departments found</td></tr>
                            ) : filteredDepartments.map(dept => (
                                <tr key={dept._id} onClick={() => handleRowClick(dept)} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 150ms ease' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{dept.name}</div>
                                        {dept.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{dept.description}</div>}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        {dept.head ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', border: '1px solid var(--accent)', color: 'var(--accent)' }}>{dept.head?.username || 'Unknown'}</span>
                                                <button onClick={e => {
                                                    e.stopPropagation();
                                                    if (company?.defaultWorkspace) navigate(`/workspace/${company.defaultWorkspace}/dm/new/${dept.head._id}`);
                                                    else alert('No default workspace available.');
                                                }} style={{ padding: '3px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '2px', transition: 'color 150ms ease' }}
                                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'} title="Message Manager">
                                                    <MessageCircle size={13} />
                                                </button>
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Unassigned</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            <Users size={12} style={{ color: 'var(--text-muted)' }} /> {dept.members?.length || 0}
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(dept.createdAt).toLocaleDateString()}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                        <ActionIconBtn icon={Edit} onClick={e => { e.stopPropagation(); handleEdit(dept); }} hoverColor="var(--accent)" />
                                        <ActionIconBtn icon={Trash2} onClick={e => { e.stopPropagation(); handleDelete(dept._id); }} hoverColor="var(--state-danger)" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <DepartmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} department={selectedDept} companyId={company?._id} onSuccess={fetchDepartments} />
            <DepartmentDetailsModal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} department={viewDepartment} companyId={company?._id} onUpdate={() => { fetchDepartments(); setIsDetailsOpen(false); }} />
        </React.Fragment>
    );
};

const CreateBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: hov ? 'var(--accent-hover)' : 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'background 150ms ease' }}>
            <Plus size={13} /> Add Department
        </button>
    );
};

const ActionIconBtn = ({ icon: Icon, onClick, hoverColor }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ padding: '5px', background: hov ? 'var(--bg-active)' : 'none', border: hov ? `1px solid var(--border-default)` : '1px solid transparent', color: hov ? hoverColor : 'var(--text-muted)', cursor: 'pointer', borderRadius: '2px', marginLeft: '2px', transition: 'all 150ms ease' }}>
            <Icon size={13} />
        </button>
    );
};

export default DepartmentManagement;
