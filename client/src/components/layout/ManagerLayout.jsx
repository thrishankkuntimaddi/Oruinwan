import React from 'react';
import { Outlet } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import ManagerSidebar from '../manager/ManagerSidebar';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { Shield } from 'lucide-react';

const ManagerLayout = () => {
    const { company, isCompanyOwner, isCompanyAdmin } = useCompany();
    const { user } = useAuth();
    const navigate = useNavigate();

    const showAdminButton = isCompanyOwner() || isCompanyAdmin();

    const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(String(id ?? ''));

    const selectedDept = (() => {
        const depts = company?.departments ?? [];
        const managed = depts.find(d => d.head?._id === user?._id || d.head === user?._id);
        const candidate = managed ?? depts[0] ?? null;
        return candidate && isValidObjectId(candidate._id) ? candidate : null;
    })();

    return (
        <div style={{
            display: 'flex', height: '100vh', overflow: 'hidden',
            background: 'var(--bg-base)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}>
            <ManagerSidebar />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minWidth: 0 }}>
                {/* Top Context Bar */}
                <header style={{
                    height: '56px', flexShrink: 0,
                    padding: '0 28px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--bg-surface)',
                    borderBottom: '1px solid var(--border-subtle)',
                    zIndex: 10,
                }}>
                    <div>
                        <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            Workspace Manager
                        </p>
                        <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
                            {company?.displayName || company?.name || 'My Company'}
                        </h1>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {showAdminButton && (
                            <AdminConsoleBtn onClick={() => navigate('/admin/dashboard')} />
                        )}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                        </span>
                    </div>
                </header>

                {/* Main Content */}
                <main style={{ flex: 1, overflow: 'hidden', background: 'var(--bg-base)', position: 'relative' }}>
                    <Outlet context={{ selectedDepartment: selectedDept }} />
                </main>
            </div>
        </div>
    );
};

const AdminConsoleBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: hov ? 'rgba(184,149,106,0.15)' : 'var(--bg-active)', border: '1px solid var(--border-default)', color: hov ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
            <Shield size={12} /> Admin Console
        </button>
    );
};

export default ManagerLayout;
